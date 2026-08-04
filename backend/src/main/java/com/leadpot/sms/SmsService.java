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

/**
 * 문자 발송 진입점. 자격증명 해결 → 플랜 한도 검사 → 발송 → 이력 기록을 한 자리에서 처리한다.
 *
 * <p>자격증명(docs/MESSAGING-PLAN.md §11): <b>리드팟 솔라피 계정 하나</b>로만 보낸다.
 * 우리 비용이므로 플랜별 월 한도를 적용한다.
 *
 * <p>발송은 예외를 던지지 않는다 — 리드 접수를 방해하면 안 되기 때문이다. 실패도 이력에 남긴다.
 */
@Service
public class SmsService {

    /** 서울 기준 월 경계로 사용량을 센다(사용자·과금 기준이 국내 시각이다). */
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final SmsSender sender;
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
            UserRepository userRepository,
            MessageLogRepository logRepository,
            MessageLogWriter logWriter,
            @Value("${app.sms.solapi.api-key:}") String systemApiKey,
            @Value("${app.sms.solapi.api-secret:}") String systemApiSecret,
            @Value("${app.sms.solapi.sender-phone:}") String systemSenderPhone,
            @Value("${app.sms.monthly-limit.free:100}") int monthlyFree,
            @Value("${app.sms.monthly-limit.pro:5000}") int monthlyPro) {
        this.sender = sender;
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
            Long formId, Long leadId, Long ruleId, Long templateId, String senderPhoneOverride,
            String imageId) {

        public static SmsRequest to(Long ownerId, String to, String text, String recipientType) {
            return new SmsRequest(ownerId, to, text, recipientType, null, null, null, null, null, null);
        }

        public SmsRequest forLead(Long formId, Long leadId) {
            return new SmsRequest(ownerId, to, text, recipientType, formId, leadId, ruleId, templateId,
                    senderPhoneOverride, imageId);
        }

        public SmsRequest withSenderPhone(String phone) {
            return new SmsRequest(ownerId, to, text, recipientType, formId, leadId, ruleId, templateId, phone,
                    imageId);
        }

        /** 첨부 이미지(대행사 fileId)를 붙인다 — 붙으면 MMS 로 나간다. */
        public SmsRequest withImage(String imageId) {
            return new SmsRequest(ownerId, to, text, recipientType, formId, leadId, ruleId, templateId,
                    senderPhoneOverride, imageId);
        }
    }

    /**
     * 문자 1건 발송 후 이력을 남긴다. 성공 여부와 무관하게 이력이 생기며 예외를 던지지 않는다.
     *
     * @return 남긴 이력(상태 확인용)
     */
    public MessageLog send(SmsRequest req) {
        String channel = SolapiSmsSender.channelOf(req.text(), req.imageId());
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

        SmsSender.SmsResult result = sender.send(cred, req.to(), req.text(), req.imageId());
        MessageLog entry = base(req, result.channel(),
                result.ok() ? MessageLog.STATUS_SENT : MessageLog.STATUS_FAILED, cred.system());
        entry.setProviderMessageId(result.providerMessageId());
        entry.setError(cut(result.error(), 500));
        logWriter.record(entry);
        return entry;
    }

    /**
     * 첨부 이미지를 대행사에 올리고 참조용 id 를 돌려준다. 규격 변환({@link SmsImages})은 호출부에서 끝낸 뒤 넘긴다.
     * 발송 때마다 올리면 느리고 비용도 낭비라 <b>리드폼 편집 중 한 번</b>만 올린다.
     */
    public SmsSender.UploadResult uploadAttachment(Long ownerId, byte[] jpeg, String name) {
        SmsCredentials cred = resolveCredentials(ownerId, null);
        if (cred == null || !cred.usable()) {
            return SmsSender.UploadResult.failed("문자 발송 설정이 없습니다. 발신번호·API 키를 확인해주세요.");
        }
        return sender.upload(cred, jpeg, name);
    }

    // ---------- 자격증명 ----------

    /**
     * 발송에 쓸 자격증명. 지금은 <b>리드팟 계정 하나뿐</b>이다(2026-08-02 결정, V24).
     *
     * <p>발신번호만 리드폼별로 덮어쓸 수 있다. 단 그 번호도 <b>우리 솔라피 계정에 사전등록된 번호</b>여야 한다 —
     * 마케터 번호를 쓰려면 위임 등록(위임장·위수탁계약서)이 필요하다(docs/MESSAGING-PLAN.md §11).
     *
     * <p>나중에 마케터가 자기 대행사 계정을 연동하게 하려면 여기서 마케터 키를 먼저 찾아 쓰고,
     * 없을 때만 시스템 키로 떨어지게 하면 된다. {@link SmsCredentials#system()} 플래그와
     * 플랜 한도 분기는 그때를 위해 남겨뒀다.
     */
    public SmsCredentials resolveCredentials(Long ownerId, String senderPhoneOverride) {
        return new SmsCredentials(systemApiKey, systemApiSecret,
                pick(senderPhoneOverride, systemSenderPhone), true);
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
