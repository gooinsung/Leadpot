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

import com.leadpot.advertiser.dto.AdvertiserMeResponse;
import com.leadpot.advertiser.dto.BrandSettings;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.InvalidSubmissionException;

/**
 * A7 화이트라벨 검증. 마케터가 저장한 로고·색상이 <b>광고주 화면(me)</b>에 그대로 반영돼야 한다.
 */
@SpringBootTest
@Transactional
class AdvertiserBrandTest {

    @Autowired
    private AdvertiserService advertiserService;
    @Autowired
    private AdvertiserLeadService leadService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private User marketer;

    @BeforeEach
    void setUp() {
        marketer = userRepository.save(marketer());
    }

    @Test
    @DisplayName("브랜드 저장 후 조회하면 그대로 나온다")
    void saveAndGet() {
        advertiserService.updateBrand(marketer.getId(),
                new BrandSettings("https://cdn.example.com/logo.png", "#4f46e5"));
        BrandSettings got = advertiserService.getBrand(marketer.getId());
        assertThat(got.logoUrl()).isEqualTo("https://cdn.example.com/logo.png");
        assertThat(got.color()).isEqualTo("#4f46e5");
    }

    @Test
    @DisplayName("저장한 브랜드가 광고주 화면(me)에 반영된다")
    void reflectedInAdvertiserMe() {
        advertiserService.updateBrand(marketer.getId(),
                new BrandSettings("https://cdn.example.com/logo.png", "#0ea5e9"));
        User advertiser = userRepository.save(User.advertiser("brand-a@test.local",
                passwordEncoder.encode("pw12345678"), "광고주", null, marketer.getId(), "회사"));

        AdvertiserMeResponse me = leadService.me(advertiser.getId());
        assertThat(me.brandLogoUrl()).isEqualTo("https://cdn.example.com/logo.png");
        assertThat(me.brandColor()).isEqualTo("#0ea5e9");
    }

    @Test
    @DisplayName("색상 형식이 틀리면 거부된다")
    void invalidColorRejected() {
        assertThatThrownBy(() -> advertiserService.updateBrand(marketer.getId(),
                new BrandSettings(null, "blue")))
                .isInstanceOf(InvalidSubmissionException.class);
    }

    @Test
    @DisplayName("빈 값으로 저장하면 브랜드가 해제된다(null)")
    void blankClearsBrand() {
        advertiserService.updateBrand(marketer.getId(), new BrandSettings("x", "#fff"));
        BrandSettings cleared = advertiserService.updateBrand(marketer.getId(), new BrandSettings("  ", ""));
        assertThat(cleared.logoUrl()).isNull();
        assertThat(cleared.color()).isNull();
    }

    private User marketer() {
        User u = new User("brand-m@test.local", passwordEncoder.encode("pw12345678"), "마케터", null);
        u.setSubdomain("brand-m");
        return u;
    }
}
