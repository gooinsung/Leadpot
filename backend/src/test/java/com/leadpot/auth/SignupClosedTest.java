package com.leadpot.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.advertiser.AdvertiserInviteService;
import com.leadpot.advertiser.dto.InviteAcceptRequest;
import com.leadpot.advertiser.dto.InviteRequest;
import com.leadpot.auth.dto.SignupRequest;
import com.leadpot.common.error.SignupClosedException;

/**
 * 공개 회원가입 차단 검증(2026-08-06 사용자 결정 — 운영자가 계정을 직접 관리).
 *
 * <p><b>화면을 지우는 것만으로는 부족하다</b>는 것이 이 테스트의 요지다. {@code /api/auth/signup} 은
 * 공개 엔드포인트라 curl 한 줄로 계정을 만들 수 있으므로 서버가 거부해야 한다.
 *
 * <p>함께 지키는 것: <b>광고주 초대 수락은 계속 동작해야 한다.</b> 마케터가 발급한 링크로만
 * 만들어지므로 막을 이유가 없고, 막히면 광고주를 새로 못 들이는 회귀가 된다.
 */
class SignupClosedTest {

    private static SignupRequest signupRequest(String email) {
        return new SignupRequest(email, "pw12345678", "테스터", "01012345678");
    }

    @Nested
    @SpringBootTest
    @Transactional
    @DisplayName("기본값(닫힘)")
    class Closed {

        @Autowired
        private AuthService authService;
        @Autowired
        private AdvertiserInviteService inviteService;
        @Autowired
        private UserRepository userRepository;
        @Autowired
        private PasswordEncoder passwordEncoder;

        @Test
        @DisplayName("공개 회원가입은 거부된다 — 계정이 만들어지지 않는다")
        void signupRejected() {
            assertThatThrownBy(() -> authService.signup(signupRequest("intruder@test.local")))
                    .isInstanceOf(SignupClosedException.class);
            assertThat(userRepository.existsByEmail("intruder@test.local")).isFalse();
        }

        @Test
        @DisplayName("⚠️ 광고주 초대 수락은 계속 동작한다(가입 차단과 무관)")
        void advertiserInviteStillWorks() {
            User m = new User("closed-m@test.local", passwordEncoder.encode("pw12345678"), "마케터", null);
            m.setSubdomain("closed-m");
            User marketer = userRepository.save(m);

            String token = inviteService.issue(marketer.getId(),
                    new InviteRequest("closed-adv@test.local", "광고주", "회사")).token();

            inviteService.accept(token, new InviteAcceptRequest("pw12345678", "광고주", null));

            assertThat(userRepository.existsByEmail("closed-adv@test.local")).isTrue();
        }
    }

    @Nested
    @SpringBootTest(properties = "app.auth.signup-enabled=true")
    @Transactional
    @DisplayName("설정을 켜면 다시 열린다")
    class Open {

        @Autowired
        private AuthService authService;
        @Autowired
        private UserRepository userRepository;

        @Test
        @DisplayName("app.auth.signup-enabled=true 면 가입된다")
        void signupWorksWhenEnabled() {
            authService.signup(signupRequest("welcome@test.local"));
            assertThat(userRepository.existsByEmail("welcome@test.local")).isTrue();
        }
    }
}
