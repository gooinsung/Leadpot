package com.leadpot.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.auth.dto.TokenResponse;
import com.leadpot.common.error.InvalidSubmissionException;

/**
 * 마케터 비밀번호 재설정(V36) — 셀프서비스 인증번호 흐름 검증.
 *
 * <p>지켜야 하는 것:
 * <ol>
 * <li><b>존재 여부 비노출</b> — 없는 이메일·광고주·휴대폰 없는 계정 요청도 예외 없이 끝난다.</li>
 * <li><b>시도 제한</b> — 6자리 숫자는 무제한 대입이면 뚫린다. 틀린 횟수가 남아야 하고,
 * 상한을 넘으면 맞는 번호도 거부해야 한다.</li>
 * <li><b>쿨다운</b> — 연타로 문자(비용)가 반복 발송되면 안 된다.</li>
 * </ol>
 *
 * <p>실제 문자 발송은 테스트 환경에 솔라피 자격증명이 없어 SKIPPED 로 남는다 —
 * 여기서는 발송 시도(이력 생성)가 아니라 코드 저장·검증 로직을 본다.
 */
@SpringBootTest
@Transactional
class PasswordResetTest {

    @Autowired
    private PasswordResetService service;
    @Autowired
    private PasswordResetCodeRepository codeRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private User marketer;

    @BeforeEach
    void setUp() {
        marketer = new User("reset-marketer@test.local", passwordEncoder.encode("oldpassword1"),
                "마케터", "01012345678");
        marketer.setSubdomain("reset-marketer");
        userRepository.save(marketer);
    }

    // ---------- 요청(발송) ----------

    @Test
    @DisplayName("요청하면 인증번호가 저장된다 (해시만, 원문 없음)")
    void requestCreatesCode() {
        service.request("reset-marketer@test.local");

        var codes = codeRepository.findByUserIdAndUsedAtIsNull(marketer.getId());
        assertThat(codes).hasSize(1);
        assertThat(codes.get(0).getCodeHash()).hasSize(64); // SHA-256 hex
        assertThat(codes.get(0).getExpiresAt()).isAfter(Instant.now());
    }

    @Test
    @DisplayName("없는 이메일 요청도 조용히 끝난다 — 존재 여부를 노출하지 않는다")
    void unknownEmailIsSilent() {
        service.request("no-such-user@test.local");
        assertThat(codeRepository.count()).isZero();
    }

    @Test
    @DisplayName("광고주·휴대폰 없는 계정에는 코드를 만들지 않는다")
    void advertiserAndPhonelessAreSilent() {
        User advertiser = userRepository.save(User.advertiser("reset-adv@test.local",
                passwordEncoder.encode("pw12345678"), "광고주", "01099998888", marketer.getId(), "광고주㈜"));
        User phoneless = new User("reset-nophone@test.local", passwordEncoder.encode("pw12345678"), "번호없음", null);
        phoneless.setSubdomain("reset-nophone");
        userRepository.save(phoneless);

        service.request("reset-adv@test.local");
        service.request("reset-nophone@test.local");

        assertThat(codeRepository.findByUserIdAndUsedAtIsNull(advertiser.getId())).isEmpty();
        assertThat(codeRepository.findByUserIdAndUsedAtIsNull(phoneless.getId())).isEmpty();
    }

    @Test
    @DisplayName("쿨다운 안의 재요청은 새 코드를 만들지 않는다 (문자 비용 방어)")
    void cooldownBlocksResend() {
        service.request("reset-marketer@test.local");
        service.request("reset-marketer@test.local");

        assertThat(codeRepository.count()).isEqualTo(1);
    }

    // ---------- 확인(비밀번호 변경) ----------

    @Test
    @DisplayName("맞는 인증번호면 비밀번호가 바뀌고 자동 로그인 토큰이 나온다")
    void confirmChangesPassword() {
        seedCode("123456");

        TokenResponse tokens = service.confirm("reset-marketer@test.local", "123456", "newpassword1");

        assertThat(tokens.accessToken()).isNotBlank();
        User reloaded = userRepository.findById(marketer.getId()).orElseThrow();
        assertThat(passwordEncoder.matches("newpassword1", reloaded.getPasswordHash())).isTrue();
        // 코드는 1회용 — 같은 번호로 다시 못 쓴다.
        assertThatThrownBy(() -> service.confirm("reset-marketer@test.local", "123456", "another123"))
                .isInstanceOf(InvalidSubmissionException.class);
    }

    @Test
    @DisplayName("틀린 인증번호는 시도 횟수를 올리고, 상한을 넘으면 맞는 번호도 거부한다")
    void wrongCodeCountsAndLocks() {
        PasswordResetCode code = seedCode("123456");

        for (int i = 0; i < PasswordResetCode.MAX_ATTEMPTS; i++) {
            assertThatThrownBy(() -> service.confirm("reset-marketer@test.local", "000000", "newpassword1"))
                    .isInstanceOf(InvalidSubmissionException.class);
        }
        assertThat(codeRepository.findById(code.getId()).orElseThrow().getAttempts())
                .isEqualTo(PasswordResetCode.MAX_ATTEMPTS);

        // 상한 도달 후에는 맞는 번호도 거부 — 처음(재요청)부터 다시.
        assertThatThrownBy(() -> service.confirm("reset-marketer@test.local", "123456", "newpassword1"))
                .isInstanceOf(InvalidSubmissionException.class);
        assertThat(passwordEncoder.matches("oldpassword1",
                userRepository.findById(marketer.getId()).orElseThrow().getPasswordHash())).isTrue();
    }

    @Test
    @DisplayName("만료된 인증번호는 거부한다")
    void expiredCodeRejected() {
        codeRepository.save(new PasswordResetCode(marketer.getId(), ResetCodes.hash("123456"),
                Instant.now().minus(1, ChronoUnit.MINUTES)));

        assertThatThrownBy(() -> service.confirm("reset-marketer@test.local", "123456", "newpassword1"))
                .isInstanceOf(InvalidSubmissionException.class);
    }

    @Test
    @DisplayName("정지된 계정은 인증번호가 맞아도 비밀번호를 바꿀 수 없다")
    void suspendedAccountRejected() {
        marketer.setActive(false);
        seedCode("123456");

        assertThatThrownBy(() -> service.confirm("reset-marketer@test.local", "123456", "newpassword1"))
                .isInstanceOf(InvalidSubmissionException.class);
    }

    /** 원문을 아는 코드를 심는다 — 서비스는 해시만 저장하므로 테스트가 직접 만든다. */
    private PasswordResetCode seedCode(String rawCode) {
        return codeRepository.save(new PasswordResetCode(marketer.getId(), ResetCodes.hash(rawCode),
                Instant.now().plus(10, ChronoUnit.MINUTES)));
    }
}
