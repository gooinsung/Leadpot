package com.leadpot.sms;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.auth.Plan;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.integration.IntegrationSettings;
import com.leadpot.integration.IntegrationSettingsRepository;

/**
 * 문자 발송 진입점. 자격증명 해결 → 플랜 한도 검사 → 발송 → 이력 기록을 한 자리에서 처리한다.
 *
 * <p>자격증명(docs/MESSAGING-PLAN.md §11): 마케터가 자기 솔라피 키를 등록했으면 그 키로,
 * 아니면 <b>리드팟 시스템 키</b>로 보낸다. 시스템 키로 보낼 때만 플랜 한도를 적용한다
 * (마케터 자기 키는 우리 비용이 아니므로 막을 이유가 없다).
 *
 * <p>발송은 예외를 던지지 않는다 — 리드 접수를 방해하면 안 되기 때문이다. 실패도 이력에 남긴다.
 */
@Service
public class SmsService {

    /** 서울 기준 월 경계로 사용량을 센다(사용자·과금 기준이 국내 시각이다). */
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final SmsSender sender;
    private final IntegrationSettingsRepository settingsRepository;
    private final UserRepository userRepository;
    private final MessageLogRepository logRepository;
    private final MessageLogWriter logWriter;

    /** 리드팟 솔라피 계정 — 환경변수로만 주입한다. 코드·DB·git 에 두지 않는다. */
    private final String systemApiKey;
    private final String systemApiSecret;
    private final String systemSenderPhone;
    private final int monthlyFree;
    private final int monthlyPro;

    public SmsService(SmsSender sender,
            IntegrationSettingsRepository settingsRepository,
            UserRepository userRepository,
            MessageLogRepository logRepository,
            MessageLogWriter logWriter,
            @Value("${app.sms.solapi.api-key:}") String systemApiKey,
            @Value("${app.sms.solapi.api-secret:}") String systemApiSecret,
            @Value("${app.sms.solapi.sender-phone:}") String systemSenderPhone,
            @Value("${app.sms.monthly-limit.free:100}") int monthlyFree,
            @Value("${app.sms.monthly-limit.pro:5000}") int monthlyPro) {
        this.sender = sender;
        this.settingsRepository = settingsRepository;
        this.userRepository = userRepository;
        this.logRepository = logRepository;
        this.logWriter = logWriter;
        this.systemApiKey = systemApiKey;
        this.systemApiSecret = systemApiSecret;
        this.systemSenderPhone = systemSenderPhone;
        this.monthlyFree = monthlyFree;
        this.monthlyPro = monthlyPro;
    }

    /** 발송 요청 한 건. 트랜잭션 밖(비동기 스레드)으로 넘길 수 있는 불변 스냅샷이다. */
    public record SmsRequest(Long ownerId, String to, String text, String recipientType,
            Long formId, Long leadId, Long ruleId, Long templateId, String senderPhoneOverride) {

        public static SmsRequest to(Long ownerId, String to, String text, String recipientType) {
            return new SmsRequest(ownerId, to, text, recipientType, null, null, null, null, null);
        }

        public SmsRequest forLead(Long formId, Long leadId) {
            return new SmsRequest(ownerId, to, text, recipientType, formId, leadId, ruleId, templateId,
                    senderPhoneOverride);
        }

        public SmsRequest withSenderPhone(String phone) {
            return new SmsRequest(ownerId, to, text, recipientType, formId, leadId, ruleId, templateId, phone);
        }
    }

    /**
     * 문자 1건 발송 후 이력을 남긴다. 성공 여부와 무관하게 이력이 생기며 예외를 던지지 않는다.
     *
     * @return 남긴 이력(상태 확인용)
     */
    public MessageLog send(SmsRequest req) {
        String channel = SolapiSmsSender.channelOf(req.text());
        SmsCredentials cred = resolveCredentials(req.ownerId(), req.senderPhoneOverride());

        if (cred == null || !cred.usable()) {
            return skip(req, channel, "문자 발송 설정이 없습니다. 발신번호·API 키를 확인해주세요.");
        }
        if (PhoneNumbers.normalize(req.to()) == null) {
            return skip(req, channel, "수신번호가 없거나 형식이 올바르지 않습니다.");
        }
        if (cred.system()) {
            String over = quotaError(req.ownerId());
            if (over != null) {
                return skip(req, channel, over);
            }
        }

        SmsSender.SmsResult result = sender.send(cred, req.to(), req.text());
        MessageLog entry = base(req, result.channel(),
                result.ok() ? MessageLog.STATUS_SENT : MessageLog.STATUS_FAILED, cred.system());
        entry.setProviderMessageId(result.providerMessageId());
        entry.setError(cut(result.error(), 500));
        logWriter.record(entry);
        return entry;
    }

    // ---------- 자격증명 ----------

    /**
     * 이 마케터가 쓸 자격증명. 마케터 키가 완전히 갖춰졌을 때만 그것을 쓰고, 그 외에는 시스템 키다.
     * (키만 넣고 발신번호를 안 넣은 어중간한 상태에서 조용히 실패하지 않도록 {@code usable()} 로 판단한다.)
     */
    @Transactional(readOnly = true)
    public SmsCredentials resolveCredentials(Long ownerId, String senderPhoneOverride) {
        IntegrationSettings s = settingsRepository.findById(ownerId).orElse(null);
        if (s != null && s.isSmsEnabled()) {
            SmsCredentials own = new SmsCredentials(s.getSmsApiKey(), s.getSmsApiSecret(),
                    pick(senderPhoneOverride, s.getSmsSenderPhone()), false);
            if (own.usable()) {
                return own;
            }
        }
        // 시스템 키의 발신번호는 우리 명의 등록번호다. 마케터 번호를 쓰려면 위임 등록이 필요하다(§11).
        return new SmsCredentials(systemApiKey, systemApiSecret, systemSenderPhone, true);
    }

    /** 이 마케터가 지금 문자를 보낼 수 있는 상태인가(화면 안내용). */
    @Transactional(readOnly = true)
    public boolean ready(Long ownerId) {
        SmsCredentials cred = resolveCredentials(ownerId, null);
        return cred != null && cred.usable();
    }

    // ---------- 플랜 한도 ----------

    /** 이번 달(서울 기준) 시스템 키 발송 건수. */
    @Transactional(readOnly = true)
    public long usedThisMonth(Long ownerId) {
        return logRepository.countSystemSentSince(ownerId, monthStart());
    }

    /** 이 플랜의 월 상한. 0 이면 무제한. */
    public int monthlyLimit(Plan plan) {
        return plan == Plan.PRO ? monthlyPro : monthlyFree;
    }

    /** 한도를 넘었으면 사유 문자열, 여유가 있으면 null. */
    private String quotaError(Long ownerId) {
        User owner = userRepository.findById(ownerId).orElse(null);
        int limit = monthlyLimit(owner == null ? Plan.FREE : owner.getPlan());
        if (limit <= 0) {
            return null; // 0 = 무제한
        }
        long used = usedThisMonth(ownerId);
        if (used < limit) {
            return null;
        }
        return "이번 달 문자 발송 한도(" + limit + "건)를 모두 사용했습니다. 요금제를 올리면 계속 보낼 수 있습니다.";
    }

    private static Instant monthStart() {
        return LocalDate.now(KST).withDayOfMonth(1).atStartOfDay(KST).toInstant();
    }

    // ---------- 이력 ----------

    /** 보내지 않고 사유만 남긴다. 조용히 사라지면 마케터가 알 수 없으므로 반드시 기록한다. */
    private MessageLog skip(SmsRequest req, String channel, String reason) {
        MessageLog entry = base(req, channel, MessageLog.STATUS_SKIPPED, true);
        entry.setError(reason);
        logWriter.record(entry);
        return entry;
    }

    private static MessageLog base(SmsRequest req, String channel, String status, boolean system) {
        MessageLog entry = new MessageLog(req.ownerId(), req.recipientType(), channel, status);
        entry.setFormId(req.formId());
        entry.setLeadId(req.leadId());
        entry.setRuleId(req.ruleId());
        entry.setTemplateId(req.templateId());
        entry.setRecipient(PhoneNumbers.mask(req.to()));
        entry.setRenderedBody(req.text());
        entry.setSystemCredential(system);
        return entry;
    }

    private static String pick(String first, String second) {
        return first != null && !first.isBlank() ? first : second;
    }

    private static String cut(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() > max ? s.substring(0, max) : s;
    }
}
