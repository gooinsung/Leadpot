package com.leadpot.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.auth.dto.TokenResponse;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.sms.PhoneNumbers;
import com.leadpot.sms.SmsService;

/**
 * 마케터 비밀번호 재설정 — 로그인 화면의 셀프서비스(V36).
 *
 * <p><b>본인 확인은 가입 때 받은 휴대폰(users.phone) 문자 인증번호</b>로 한다.
 * 이메일 발송 인프라가 없고, 확인 없이 비밀번호를 바꾸게 하면 이메일만 알면 계정을 탈취할 수 있다.
 *
 * <p><b>계정 존재 여부를 노출하지 않는다</b> — {@link #request} 는 이메일이 없어도·휴대폰이 없어도·
 * 쿨다운에 걸려도 전부 조용히 같은 응답으로 끝난다(로그인 실패 메시지를 통일한 것과 같은 원칙).
 * 실패 사유를 구분해 주면 공개 엔드포인트로 가입 이메일을 하나씩 확인할 수 있게 된다.
 *
 * <p>광고주는 이 흐름을 타지 않는다 — 담당 마케터가 링크를 발급하는 별도 절차가 있다
 * ({@link com.leadpot.advertiser.AdvertiserPasswordResetService}).
 */
@Service
public class PasswordResetService {

    /** 인증번호 유효시간. 문자 도착 지연을 감안하되 짧게 유지한다. */
    static final Duration CODE_TTL = Duration.ofMinutes(10);
    /** 재요청 쿨다운 — 연타로 문자 비용이 새는 것을 막는다(프론트도 같은 시간으로 버튼을 잠근다). */
    static final Duration RESEND_COOLDOWN = Duration.ofSeconds(60);
    /** 계정당 24시간 발송 상한. 특정 계정을 겨냥한 문자 폭탄(비용 공격) 방어. */
    static final int DAILY_CAP = 5;

    private final UserRepository userRepository;
    private final PasswordResetCodeRepository codeRepository;
    private final SmsService smsService;
    private final AuthService authService;
    private final PasswordEncoder passwordEncoder;

    public PasswordResetService(UserRepository userRepository,
            PasswordResetCodeRepository codeRepository,
            SmsService smsService,
            AuthService authService,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.codeRepository = codeRepository;
        this.smsService = smsService;
        this.authService = authService;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * 인증번호 발송 요청. <b>어떤 경우에도 예외를 던지지 않는다</b>(존재 여부 비노출 — 클래스 주석 참고).
     * 보내지 못하는 경우: 계정 없음 · 광고주 · 정지 계정 · 휴대폰 미등록/형식 오류 · 쿨다운 · 일일 상한.
     */
    @Transactional
    public void request(String rawEmail) {
        Optional<User> found = userRepository.findByEmail(normalizeEmail(rawEmail));
        if (found.isEmpty()) {
            return;
        }
        User user = found.get();
        if (user.getRole() == Role.ADVERTISER || !user.isActive()
                || PhoneNumbers.normalize(user.getPhone()) == null) {
            return;
        }

        Instant now = Instant.now();
        Optional<PasswordResetCode> latest = codeRepository.findTopByUserIdOrderByCreatedAtDesc(user.getId());
        if (latest.isPresent() && latest.get().getCreatedAt() != null
                && latest.get().getCreatedAt().isAfter(now.minus(RESEND_COOLDOWN))) {
            return; // 직전에 보낸 코드가 아직 유효하다 — 그 코드를 쓰면 된다.
        }
        if (codeRepository.countByUserIdAndCreatedAtAfter(user.getId(), now.minus(Duration.ofHours(24))) >= DAILY_CAP) {
            return;
        }

        // 살아 있는 코드가 여럿이면 어느 것이 맞는지 관리가 어려워진다 → 항상 최신 하나만 유효.
        for (PasswordResetCode old : codeRepository.findByUserIdAndUsedAtIsNull(user.getId())) {
            old.markUsed(now);
        }
        String code = ResetCodes.newCode();
        codeRepository.save(new PasswordResetCode(user.getId(), ResetCodes.hash(code), now.plus(CODE_TTL)));
        smsService.sendVerification(user.getId(), user.getPhone(),
                "[리드팟] 비밀번호 재설정 인증번호는 [" + code + "] 입니다. 10분 안에 입력해주세요.");
    }

    /**
     * 인증번호 확인 + 새 비밀번호 설정 → 자동 로그인 토큰 반환.
     *
     * <p>실패 메시지는 사유(계정 없음/코드 만료/번호 불일치)와 무관하게 <b>한 가지로 통일</b>한다 —
     * 구분해 주면 이 엔드포인트로 이메일 존재를 확인할 수 있다.
     *
     * <p>{@code noRollbackFor}: 인증번호가 틀리면 시도 횟수를 올리고 던지는데, 예외로 롤백되면
     * <b>횟수가 저장되지 않아 무제한 대입이 가능</b>해진다. 이 예외만 커밋을 유지한다.
     */
    @Transactional(noRollbackFor = InvalidSubmissionException.class)
    public TokenResponse confirm(String rawEmail, String code, String newPassword) {
        User user = userRepository.findByEmail(normalizeEmail(rawEmail))
                .filter(u -> u.getRole() != Role.ADVERTISER)
                .orElseThrow(PasswordResetService::rejected);
        if (!user.isActive()) {
            throw rejected();
        }
        Instant now = Instant.now();
        PasswordResetCode reset = codeRepository.findTopByUserIdOrderByCreatedAtDesc(user.getId())
                .filter(c -> c.usable(now))
                .orElseThrow(PasswordResetService::rejected);
        if (!reset.getCodeHash().equals(ResetCodes.hash(code == null ? "" : code.trim()))) {
            reset.recordFailedAttempt();
            throw rejected();
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        reset.markUsed(now);
        return authService.issueTokens(user);
    }

    private static InvalidSubmissionException rejected() {
        return new InvalidSubmissionException("인증번호가 올바르지 않거나 만료되었습니다. 다시 요청해주세요.");
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }
}
