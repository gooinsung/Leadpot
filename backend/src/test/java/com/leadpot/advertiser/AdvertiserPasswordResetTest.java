package com.leadpot.advertiser;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.advertiser.dto.PasswordResetResponse;
import com.leadpot.auth.Role;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.ConflictException;
import com.leadpot.common.error.NotFoundException;

/**
 * 광고주 비밀번호 재설정 검증.
 * 재설정 수단이 없으면 비밀번호를 잊은 광고주는 계정 삭제 외에 복구 방법이 없었다(초대는 중복 이메일을 거부).
 */
@SpringBootTest
@Transactional
class AdvertiserPasswordResetTest {

    @Autowired
    private AdvertiserPasswordResetService resetService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private User marketer;
    private User advertiser;

    @BeforeEach
    void setUp() {
        marketer = saveMarketer("reset-m@test.local", "reset-m");
        advertiser = userRepository.save(User.advertiser("reset-a@test.local",
                passwordEncoder.encode("oldpw12345"), "광고주", null, marketer.getId(), "회사"));
    }

    private User saveMarketer(String email, String subdomain) {
        User u = new User(email, passwordEncoder.encode("pw12345678"), "마케터", null);
        u.setSubdomain(subdomain);
        return userRepository.save(u);
    }

    @Test
    @DisplayName("재설정 링크로 새 비밀번호를 설정하면 이전 비밀번호는 무효가 된다")
    void resetChangesPassword() {
        PasswordResetResponse issued = resetService.issue(marketer.getId(), advertiser.getId());
        assertThat(issued.token()).isNotBlank();
        assertThat(issued.email()).isEqualTo("reset-a@test.local");

        resetService.complete(issued.token(), "newpw12345");

        User reloaded = userRepository.findById(advertiser.getId()).orElseThrow();
        assertThat(passwordEncoder.matches("newpw12345", reloaded.getPasswordHash())).isTrue();
        assertThat(passwordEncoder.matches("oldpw12345", reloaded.getPasswordHash())).isFalse();
    }

    @Test
    @DisplayName("같은 링크를 두 번 쓸 수 없다(1회용)")
    void linkIsSingleUse() {
        PasswordResetResponse issued = resetService.issue(marketer.getId(), advertiser.getId());
        resetService.complete(issued.token(), "newpw12345");

        assertThatThrownBy(() -> resetService.complete(issued.token(), "another12345"))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("새로 발급하면 이전 링크는 즉시 무효가 된다")
    void reissueInvalidatesPreviousLink() {
        PasswordResetResponse first = resetService.issue(marketer.getId(), advertiser.getId());
        PasswordResetResponse second = resetService.issue(marketer.getId(), advertiser.getId());

        assertThat(second.token()).isNotEqualTo(first.token());
        assertThatThrownBy(() -> resetService.info(first.token())).isInstanceOf(ConflictException.class);
        assertThat(resetService.info(second.token()).email()).isEqualTo("reset-a@test.local");
    }

    @Test
    @DisplayName("남의 광고주에게는 재설정 링크를 발급할 수 없다(404)")
    void cannotIssueForOtherMarketersAdvertiser() {
        User otherMarketer = saveMarketer("reset-m2@test.local", "reset-m2");

        assertThatThrownBy(() -> resetService.issue(otherMarketer.getId(), advertiser.getId()))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("마케터 계정에는 재설정 링크를 발급할 수 없다(광고주 전용)")
    void cannotIssueForMarketerAccount() {
        User otherMarketer = saveMarketer("reset-m3@test.local", "reset-m3");

        assertThatThrownBy(() -> resetService.issue(marketer.getId(), otherMarketer.getId()))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("정지된 광고주는 재설정으로도 되살아나지 않는다")
    void inactiveAdvertiserCannotComplete() {
        PasswordResetResponse issued = resetService.issue(marketer.getId(), advertiser.getId());
        advertiser.setActive(false);
        userRepository.flush();

        assertThatThrownBy(() -> resetService.complete(issued.token(), "newpw12345"))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("잘못된 토큰은 404")
    void unknownTokenIsNotFound() {
        assertThatThrownBy(() -> resetService.info("not-a-real-token")).isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("재설정 후에도 계정 역할·소속은 그대로 유지된다")
    void resetKeepsRoleAndParent() {
        PasswordResetResponse issued = resetService.issue(marketer.getId(), advertiser.getId());
        resetService.complete(issued.token(), "newpw12345");

        User reloaded = userRepository.findById(advertiser.getId()).orElseThrow();
        assertThat(reloaded.getRole()).isEqualTo(Role.ADVERTISER);
        assertThat(reloaded.getParentUserId()).isEqualTo(marketer.getId());
    }
}
