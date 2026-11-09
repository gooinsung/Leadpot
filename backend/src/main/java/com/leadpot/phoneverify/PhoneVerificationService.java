package com.leadpot.phoneverify;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.RateLimitedException;
import com.leadpot.form.BlockType;
import com.leadpot.form.Form;
import com.leadpot.form.FormBlock;
import com.leadpot.form.FormService;
import com.leadpot.sms.MessageLog;
import com.leadpot.sms.PhoneNumbers;
import com.leadpot.sms.SmsService;

/**
 * 리드폼 휴대폰 본인인증(V48) — 공개 폼 방문자가 문자 인증번호로 번호를 확인한다.
 *
 * <p>흐름: {@link #send} 인증번호 발송 → {@link #confirm} 번호 확인 → 1회용 통과 토큰 →
 * 리드 접수 때 {@link #consume} 가 토큰을 확인한다. 화면에서만 막으면 API 직접 호출로 뚫리므로
 * <b>최종 판정은 접수 단계(서버)</b>에서 한다.
 *
 * <p>사용자 결정(2026-11-09):
 * <ul>
 * <li>인증 문자 비용은 리드팟이 부담한다 — 마케터의 문자 발송 권한·월 한도와 무관하게 나간다.</li>
 * <li>문자를 보내지 못하면(대행사 장애·자격증명 없음·발송 상한 초과) 접수를 막지 않고 <b>미인증</b>으로 받는다
 * → {@link PhoneVerification#FALLBACK} 토큰을 발급한다.</li>
 * <li>인증 대상은 리드폼의 <b>첫 번째 연락처(tel) 항목</b>이다.</li>
 * </ul>
 */
@Service
public class PhoneVerificationService {

    /** 인증번호 유효시간. 방문자는 바로 옆 칸에 입력하므로 짧게 둔다. */
    static final Duration CODE_TTL = Duration.ofMinutes(3);
    /** 통과 토큰 유효시간 — 인증 뒤 나머지 항목을 채우고 제출할 여유. */
    static final Duration TOKEN_TTL = Duration.ofMinutes(30);
    /** 재발송 쿨다운(프론트도 같은 시간으로 버튼을 잠근다). */
    static final Duration RESEND_COOLDOWN = Duration.ofSeconds(60);
    /** 번호별 24시간 발송 상한 — 특정인을 겨냥한 문자 폭탄 방어. */
    static final int DAILY_CAP_PER_PHONE = 5;
    /** IP 별 24시간 발송 상한 — 번호를 바꿔 가며 쏘는 비용 공격 방어. */
    static final int DAILY_CAP_PER_IP = 20;
    /** 폼별 24시간 발송 상한 — IP·번호를 모두 바꾸는 공격에 대한 마지막 비용 천장. */
    static final int DAILY_CAP_PER_FORM = 1000;

    private final PhoneVerificationRepository repository;
    private final FormService formService;
    private final SmsService smsService;

    public PhoneVerificationService(PhoneVerificationRepository repository, FormService formService,
            SmsService smsService) {
        this.repository = repository;
        this.formService = formService;
        this.smsService = smsService;
    }

    /**
     * 인증번호 발송 결과.
     *
     * @param mode  {@code SENT}(문자 발송 — 인증번호 입력 대기) / {@code FALLBACK}(못 보냄 — {@code token} 으로 미인증 접수)
     * @param token FALLBACK 일 때만 채워지는 통과 토큰
     */
    public record SendResult(String mode, String token, long codeTtlSeconds, long cooldownSeconds) {
    }

    @Transactional
    public SendResult send(Long formId, String rawPhone, String ip) {
        Form form = requireVerificationForm(formId);
        String phone = mobile(rawPhone);
        String phoneHash = VerifyCodes.hash(phone);
        Instant now = Instant.now();

        Optional<PhoneVerification> latest = repository
                .findTopByFormIdAndPhoneHashAndSmsSentTrueOrderByCreatedAtDesc(form.getId(), phoneHash);
        if (latest.isPresent() && latest.get().getCreatedAt() != null
                && latest.get().getCreatedAt().isAfter(now.minus(RESEND_COOLDOWN))) {
            long wait = Duration.between(now, latest.get().getCreatedAt().plus(RESEND_COOLDOWN)).toSeconds() + 1;
            throw new RateLimitedException("인증번호를 이미 보냈습니다. " + wait + "초 후에 다시 요청할 수 있어요.");
        }

        String ipKey = cut(ip, 64);
        if (overDailyCap(form.getId(), phoneHash, ipKey, now)) {
            return fallback(form.getId(), phoneHash, ipKey);
        }

        String code = VerifyCodes.newCode();
        PhoneVerification v = repository.save(PhoneVerification.pending(form.getId(), phoneHash,
                VerifyCodes.hash(code), now.plus(CODE_TTL), ipKey));
        MessageLog log = smsService.sendLeadVerification(form.getOwnerId(), form.getId(), phone,
                message(code), message("······"));
        if (!MessageLog.STATUS_SENT.equals(log.getStatus())) {
            // 사용자 결정: 못 보내면 미인증으로라도 받는다. 이 행은 문자를 안 보냈으므로 상한에 세지 않는다.
            v.downgradeToFallback();
            return new SendResult(PhoneVerification.FALLBACK, issueToken(v, now), 0, 0);
        }
        v.markSmsSent();
        return new SendResult("SENT", null, CODE_TTL.toSeconds(), RESEND_COOLDOWN.toSeconds());
    }

    /**
     * 인증번호 확인 → 통과 토큰.
     *
     * <p>{@code noRollbackFor}: 틀리면 시도 횟수를 올리고 던지는데, 롤백되면 횟수가 저장되지 않아
     * 무제한 대입이 가능해진다(비밀번호 재설정과 같은 이유).
     */
    @Transactional(noRollbackFor = InvalidSubmissionException.class)
    public String confirm(Long formId, String rawPhone, String code) {
        Form form = requireVerificationForm(formId);
        String phoneHash = VerifyCodes.hash(mobile(rawPhone));
        Instant now = Instant.now();
        PhoneVerification v = repository
                .findTopByFormIdAndPhoneHashAndSmsSentTrueOrderByCreatedAtDesc(form.getId(), phoneHash)
                .filter(x -> x.codeUsable(now))
                .orElseThrow(() -> new InvalidSubmissionException(
                        "인증번호가 만료되었거나 입력 횟수를 넘었습니다. 인증번호를 다시 받아주세요."));
        String input = code == null ? "" : code.replaceAll("\\D", "");
        if (!v.getCodeHash().equals(VerifyCodes.hash(input))) {
            v.recordFailedAttempt();
            int left = PhoneVerification.MAX_ATTEMPTS - v.getAttempts();
            throw new InvalidSubmissionException(left > 0
                    ? "인증번호가 일치하지 않습니다. (남은 횟수 " + left + "회)"
                    : "인증번호를 " + PhoneVerification.MAX_ATTEMPTS + "회 틀렸습니다. 인증번호를 다시 받아주세요.");
        }
        v.markVerified();
        return issueToken(v, now);
    }

    /**
     * 리드 접수 시 인증 확인. 이 폼이 인증을 쓰지 않으면 아무것도 하지 않는다.
     *
     * <p>호출부(LeadService)의 트랜잭션 안에서 토큰을 '사용됨'으로 바꾼다 — 접수가 뒤에서 실패해
     * 롤백되면 토큰도 되살아나 방문자가 다시 인증하지 않아도 된다.
     *
     * @return 인증을 통과했으면 true. 미인증 접수(FALLBACK)이거나 인증할 번호가 없으면 false
     * @throws InvalidSubmissionException 인증이 필요한데 토큰이 없거나 · 만료됐거나 · 번호가 바뀐 경우
     */
    @Transactional
    public boolean consume(Form form, List<Map<String, Object>> answers, String token) {
        if (!form.isRequirePhoneVerification()) {
            return false;
        }
        String phone = PhoneNumbers.normalize(verificationPhone(form, answers));
        if (phone == null) {
            // 인증할 연락처가 비어 있다(선택 항목을 비운 경우 등). 필수·형식 검증은 접수 검증이 따로 한다.
            return false;
        }
        if (token == null || token.isBlank()) {
            throw new InvalidSubmissionException("휴대폰 인증을 완료해주세요.");
        }
        Instant now = Instant.now();
        PhoneVerification v = repository.findByTokenHash(VerifyCodes.hash(token.trim()))
                .filter(x -> x.getFormId().equals(form.getId()) && x.tokenUsable(now))
                .orElseThrow(() -> new InvalidSubmissionException("휴대폰 인증이 만료되었습니다. 다시 인증해주세요."));
        if (!v.getPhoneHash().equals(VerifyCodes.hash(phone))) {
            throw new InvalidSubmissionException("인증한 번호와 입력한 연락처가 다릅니다. 다시 인증해주세요.");
        }
        v.markUsed(now);
        return v.isVerified();
    }

    /**
     * 인증 대상 번호 — 리드폼의 첫 번째 연락처(tel) 입력 항목 값. 항목명으로 답변을 찾고,
     * 항목명이 비어 있거나 못 찾으면 첫 tel 답변으로 대신한다.
     */
    static String verificationPhone(Form form, List<Map<String, Object>> answers) {
        if (answers == null) {
            return "";
        }
        FormBlock tel = form.getBlocks().stream()
                .filter(b -> b.getBlockType() == BlockType.FIELD && "tel".equals(b.getFieldType()))
                .findFirst().orElse(null);
        if (tel == null) {
            return "";
        }
        String label = tel.answerLabel();
        if (!label.isBlank()) {
            for (Map<String, Object> a : answers) {
                if (label.equals(str(a.get("label"))) && "tel".equals(str(a.get("fieldType")))) {
                    return str(a.get("value"));
                }
            }
        }
        for (Map<String, Object> a : answers) {
            if ("tel".equals(str(a.get("fieldType")))) {
                return str(a.get("value"));
            }
        }
        return "";
    }

    // ---------- 내부 ----------

    private Form requireVerificationForm(Long formId) {
        if (formId == null) {
            throw new InvalidSubmissionException("리드폼 정보가 없습니다.");
        }
        Form form = formService.getEntity(formId);
        if (!form.isRequirePhoneVerification()) {
            throw new InvalidSubmissionException("이 리드폼은 휴대폰 인증을 사용하지 않습니다.");
        }
        return form;
    }

    /** 휴대폰(01x) 번호만 받는다 — 유선 번호로는 문자를 받을 수 없다. */
    private static String mobile(String raw) {
        String phone = PhoneNumbers.normalize(raw);
        if (phone == null || !phone.startsWith("01") || phone.length() < 10) {
            throw new InvalidSubmissionException("휴대폰 번호를 정확히 입력해주세요.");
        }
        return phone;
    }

    private boolean overDailyCap(Long formId, String phoneHash, String ip, Instant now) {
        Instant dayAgo = now.minus(Duration.ofHours(24));
        if (repository.countByPhoneHashAndSmsSentTrueAndCreatedAtAfter(phoneHash, dayAgo) >= DAILY_CAP_PER_PHONE) {
            return true;
        }
        if (ip != null && !ip.isBlank()
                && repository.countByRequesterIpAndSmsSentTrueAndCreatedAtAfter(ip, dayAgo) >= DAILY_CAP_PER_IP) {
            return true;
        }
        return repository.countByFormIdAndSmsSentTrueAndCreatedAtAfter(formId, dayAgo) >= DAILY_CAP_PER_FORM;
    }

    private SendResult fallback(Long formId, String phoneHash, String ip) {
        PhoneVerification v = repository.save(PhoneVerification.fallback(formId, phoneHash, ip));
        return new SendResult(PhoneVerification.FALLBACK, issueToken(v, Instant.now()), 0, 0);
    }

    private static String issueToken(PhoneVerification v, Instant now) {
        String token = VerifyCodes.newToken();
        v.issueToken(VerifyCodes.hash(token), now.plus(TOKEN_TTL));
        return token;
    }

    private static String message(String code) {
        return "[리드팟] 인증번호는 [" + code + "] 입니다. 3분 안에 입력해주세요.";
    }

    private static String str(Object o) {
        return o == null ? "" : o.toString();
    }

    private static String cut(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() > max ? s.substring(0, max) : s;
    }
}
