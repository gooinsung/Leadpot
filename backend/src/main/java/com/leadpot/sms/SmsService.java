package com.leadpot.sms;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;

/**
 * 문자 발송 진입점. 자격증명 해결 → <b>계정 권한 검사</b> → 발송 → 이력 기록을 한 자리에서 처리한다.
 *
 * <p>자격증명(docs/MESSAGING-PLAN.md §11): <b>리드팟 솔라피 계정 하나</b>로만 보낸다.
 * 우리 비용이므로 계정별로 발송 권한·허용 채널·월 상한을 적용한다({@link SmsPermissions}, V25).
 *
 * <p><b>⚠️ 여기가 최종 관문이다.</b> 화면에서 숨기는 것만으로는 API 직접 호출로 뚫린다 —
 * 발송 경로는 전부 {@link #send} 를 지나가므로 검사는 반드시 여기에 있어야 한다.
 *
 * <p>발송은 예외를 던지지 않는다 — 리드 접수를 방해하면 안 되기 때문이다. 실패·차단도 이력에 남긴다.
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

    /**
     * 알림톡 채널·템플릿. 자격증명은 아니지만(이것만으로는 못 보낸다) 값이 바뀔 수 있어 같이 환경변수로 둔다 —
     * 템플릿을 재심사해 새 id 를 받아도 재배포 없이 교체된다.
     */
    private final String alimtalkPfId;
    private final String alimtalkTemplateId;

    public SmsService(SmsSender sender,
            UserRepository userRepository,
            MessageLogRepository logRepository,
            MessageLogWriter logWriter,
            @Value("${app.sms.solapi.api-key:}") String systemApiKey,
            @Value("${app.sms.solapi.api-secret:}") String systemApiSecret,
            @Value("${app.sms.solapi.sender-phone:}") String systemSenderPhone,
            @Value("${app.sms.solapi.pf-id:}") String alimtalkPfId,
            @Value("${app.sms.solapi.ata-template-id:}") String alimtalkTemplateId) {
        this.sender = sender;
        this.userRepository = userRepository;
        this.logRepository = logRepository;
        this.logWriter = logWriter;
        this.systemApiKey = systemApiKey;
        this.systemApiSecret = systemApiSecret;
        this.systemSenderPhone = systemSenderPhone;
        this.alimtalkPfId = alimtalkPfId;
        this.alimtalkTemplateId = alimtalkTemplateId;
    }

    /**
     * 발송 요청 한 건. 트랜잭션 밖(비동기 스레드)으로 넘길 수 있는 불변 스냅샷이다.
     *
     * @param text              문자 본문. 알림톡으로 나가는 요청에서도 채워 둔다 —
     *                          알림톡 설정이 없으면 이 본문이 문자로 나가는 폴백이 된다
     * @param alimtalkVariables 값이 있으면 <b>알림톡 후보</b>다(실제 채널은 {@link #useAlimtalk} 가 정한다).
     *                          키는 {@code "#{담당역할}"} 형태
     */
    public record SmsRequest(Long ownerId, String to, String text, String recipientType,
            Long formId, Long leadId, Long ruleId, Long templateId, String senderPhoneOverride,
            String imageId, java.util.Map<String, String> alimtalkVariables) {

        public static SmsRequest to(Long ownerId, String to, String text, String recipientType) {
            return new SmsRequest(ownerId, to, text, recipientType, null, null, null, null, null, null, null);
        }

        public SmsRequest forLead(Long formId, Long leadId) {
            return new SmsRequest(ownerId, to, text, recipientType, formId, leadId, ruleId, templateId,
                    senderPhoneOverride, imageId, alimtalkVariables);
        }

        public SmsRequest withSenderPhone(String phone) {
            return new SmsRequest(ownerId, to, text, recipientType, formId, leadId, ruleId, templateId, phone,
                    imageId, alimtalkVariables);
        }

        /** 첨부 이미지(대행사 fileId)를 붙인다 — 붙으면 MMS 로 나간다. */
        public SmsRequest withImage(String imageId) {
            return new SmsRequest(ownerId, to, text, recipientType, formId, leadId, ruleId, templateId,
                    senderPhoneOverride, imageId, alimtalkVariables);
        }

        /** 알림톡으로 보낼 변수를 붙인다(마케터·광고주 접수 알림). */
        public SmsRequest withAlimtalk(java.util.Map<String, String> variables) {
            return new SmsRequest(ownerId, to, text, recipientType, formId, leadId, ruleId, templateId,
                    senderPhoneOverride, imageId, variables);
        }
    }

    /**
     * 문자 1건 발송 후 이력을 남긴다. 성공 여부와 무관하게 이력이 생기며 예외를 던지지 않는다.
     *
     * @return 남긴 이력(상태 확인용)
     */
    public MessageLog send(SmsRequest req) {
        boolean alimtalk = useAlimtalk(req);
        String channel = alimtalk ? SmsPermissions.ATA : SolapiSmsSender.channelOf(req.text(), req.imageId());
        SmsCredentials cred = resolveCredentials(req.ownerId(), req.senderPhoneOverride());

        // 계정 권한(V25)을 가장 먼저 본다.
        // ⚠️ 순서가 중요하다 — 자격증명 검사를 먼저 하면 권한 없는 계정에
        // "발신번호·API 키를 확인해주세요"가 남아, 마케터가 고칠 수 없는 걸 고치려 들게 된다.
        // 권한 판정은 자격증명과 무관하므로 앞에 두는 게 맞다.
        //
        // 우리 비용으로 나가는 발송(system 자격증명)에만 적용한다 — 나중에 마케터가 자기 대행사
        // 계정을 연동하면 그 발송은 본인 비용이라 우리가 막을 이유가 없다.
        // cred 가 null 이면 보수적으로 시스템 발송(=우리 비용)으로 본다.
        if (cred == null || cred.system()) {
            String denied = denyReason(req.ownerId(), channel);
            if (denied != null) {
                return skip(req, channel, denied);
            }
        }
        if (cred == null || !cred.usable()) {
            return skip(req, channel, "문자 발송 설정이 없습니다. 발신번호·API 키를 확인해주세요.");
        }
        if (PhoneNumbers.normalize(req.to()) == null) {
            return skip(req, channel, "수신번호가 없거나 형식이 올바르지 않습니다.");
        }

        SmsSender.SmsResult result = alimtalk
                ? sender.sendAlimtalk(cred, req.to(),
                        new SmsSender.Alimtalk(alimtalkPfId, alimtalkTemplateId, req.alimtalkVariables()),
                        req.text())
                : sender.send(cred, req.to(), req.text(), req.imageId());
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

    // ---------- 알림톡 ----------

    /**
     * 이 요청을 알림톡으로 보낼 것인가.
     *
     * <p>변수를 담아 온 요청이라도 <b>채널·템플릿 환경변수가 없으면 기존 문자로 나간다</b>.
     * 이 폴백 덕분에 ① 코드가 설정보다 먼저 배포돼도 알림이 끊기지 않고
     * ② 문제가 생기면 VM 의 env 두 줄만 지우고 재기동하면 즉시 문자로 되돌아간다(재배포 불필요).
     */
    private boolean useAlimtalk(SmsRequest req) {
        return req.alimtalkVariables() != null && !req.alimtalkVariables().isEmpty()
                && notBlank(alimtalkPfId) && notBlank(alimtalkTemplateId);
    }

    /** 알림톡을 보낼 수 있는 설정이 갖춰졌는가(화면 안내용). */
    public boolean alimtalkConfigured() {
        return notBlank(alimtalkPfId) && notBlank(alimtalkTemplateId);
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
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

    // ---------- 계정 권한·한도 (V25) ----------

    /** 이번 달(서울 기준) 시스템 키 발송 건수. */
    @Transactional(readOnly = true)
    public long usedThisMonth(Long ownerId) {
        return logRepository.countSystemSentSince(ownerId, monthStart());
    }

    /**
     * 발송을 막아야 하는 사유. 보낼 수 있으면 null.
     *
     * <p><b>⚠️ 플랜 기반 한도({@code app.sms.monthly-limit.*})는 V25 에서 제거했다.</b>
     * 그 규약은 {@code limit <= 0} 을 <b>무제한</b>으로 봤는데 새 컬럼은 {@code 0} 이 <b>금지</b>다.
     * 둘을 함께 두면 권한 없는 계정이 무제한이 되므로 계정 컬럼을 유일한 기준으로 삼는다.
     */
    @Transactional(readOnly = true)
    public String denyReason(Long ownerId, String channel) {
        User owner = userRepository.findById(ownerId).orElse(null);
        if (owner == null) {
            // 계정을 못 찾으면 막는다 — 못 찾았을 때 열리면 안 된다.
            return "계정을 확인할 수 없어 문자를 보내지 않았습니다.";
        }
        // 사용량 조회는 권한·채널이 통과한 뒤에만 필요하다(불필요한 쿼리를 아낀다).
        if (!SmsPermissions.enabled(owner) || !SmsPermissions.channelAllowed(owner, channel)) {
            return SmsPermissions.denyReason(owner, channel, 0);
        }
        return SmsPermissions.denyReason(owner, channel, usedThisMonth(ownerId));
    }

    /** 이 계정의 문자 권한 현황(화면·API 안내용). */
    @Transactional(readOnly = true)
    public Permissions permissions(Long ownerId) {
        User owner = userRepository.findById(ownerId).orElse(null);
        long used = usedThisMonth(ownerId);
        return new Permissions(
                SmsPermissions.enabled(owner),
                SmsPermissions.allowedChannels(owner).stream().toList(),
                owner == null ? 0 : owner.getSmsMonthlyLimit(),
                used,
                SmsPermissions.remaining(owner, used));
    }

    /**
     * 문자 권한 현황.
     *
     * @param monthlyLimit 월 상한. <b>0 = 금지, -1 = 무제한</b>
     * @param remaining    남은 건수(무제한이면 {@link Integer#MAX_VALUE})
     */
    public record Permissions(boolean enabled, java.util.List<String> allowedChannels,
            int monthlyLimit, long used, long remaining) {
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
