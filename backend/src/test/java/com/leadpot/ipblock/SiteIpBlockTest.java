package com.leadpot.ipblock;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormService;
import com.leadpot.form.FormType;
import com.leadpot.ipblock.dto.IpBlockRequest;
import com.leadpot.landing.LandingPage;
import com.leadpot.landing.LandingPageRepository;
import com.leadpot.landing.LandingService;

/**
 * 계정 전역 접속 차단 — 등록한 IP 는 공개 랜딩·리드폼에 접속 자체가 막혀야 한다.
 * 차단 사실을 드러내지 않도록 404 로 응답하는 것까지 확인한다.
 */
@SpringBootTest
@Transactional
class SiteIpBlockTest {

    @Autowired
    private SiteIpBlockService service;
    @Autowired
    private LandingService landingService;
    @Autowired
    private FormService formService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private LandingPageRepository landingRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private User owner;
    private User other;
    private Form form;

    @BeforeEach
    void setUp() {
        owner = userRepository.save(marketer("siteblock-a@test.local", "siteblock-a"));
        other = userRepository.save(marketer("siteblock-b@test.local", "siteblock-b"));
        form = formRepository.save(new Form(owner.getId(), "상담 신청", FormType.BASIC));

        LandingPage lp = new LandingPage(owner.getId(), "공개 랜딩", "open");
        lp.setContent(List.of()); // content 는 NOT NULL
        lp.setStatus("published");
        landingRepository.save(lp);
    }

    @Test
    @DisplayName("단일 IP·CIDR 규칙이 매칭된다")
    void matchesSingleAndCidr() {
        service.add(owner.getId(), new IpBlockRequest("1.2.3.4", "테스트"));
        service.add(owner.getId(), new IpBlockRequest("10.0.0.0/24", null));

        assertThat(service.isBlocked(owner.getId(), "1.2.3.4")).isTrue();
        assertThat(service.isBlocked(owner.getId(), "10.0.0.77")).isTrue();
        assertThat(service.isBlocked(owner.getId(), "10.0.1.77")).isFalse();
        assertThat(service.isBlocked(owner.getId(), "8.8.8.8")).isFalse();
    }

    @Test
    @DisplayName("규칙은 계정별로 격리된다 — 다른 마케터에게는 걸리지 않는다")
    void isolatedPerAccount() {
        service.add(owner.getId(), new IpBlockRequest("1.2.3.4", null));
        assertThat(service.isBlocked(other.getId(), "1.2.3.4")).isFalse();
    }

    @Test
    @DisplayName("IP 를 모르면 막지 않는다 — 정상 방문자를 오탐으로 막지 않기 위해")
    void unknownIpPasses() {
        service.add(owner.getId(), new IpBlockRequest("1.2.3.4", null));
        assertThat(service.isBlocked(owner.getId(), null)).isFalse();
        assertThat(service.isBlocked(owner.getId(), "")).isFalse();
    }

    @Test
    @DisplayName("차단 IP 는 공개 랜딩에 접속할 수 없다(존재를 드러내지 않는 404)")
    void blocksPublicLanding() {
        // 차단 전에는 열린다
        assertThat(landingService.getPublicBySite("siteblock-a", "open", "1.2.3.4", "test-ua")).isNotNull();

        service.add(owner.getId(), new IpBlockRequest("1.2.3.4", "경쟁사"));

        assertThatThrownBy(() -> landingService.getPublicBySite("siteblock-a", "open", "1.2.3.4", "test-ua"))
                .isInstanceOf(NotFoundException.class);
        // 다른 IP 는 그대로 열린다
        assertThat(landingService.getPublicBySite("siteblock-a", "open", "9.9.9.9", "test-ua")).isNotNull();
    }

    @Test
    @DisplayName("차단 IP 는 공개 리드폼도 열 수 없다")
    void blocksPublicForm() {
        assertThat(formService.getPublic(form.getId(), "1.2.3.4", "test-ua")).isNotNull();

        service.add(owner.getId(), new IpBlockRequest("1.2.3.4", null));

        assertThatThrownBy(() -> formService.getPublic(form.getId(), "1.2.3.4", "test-ua"))
                .isInstanceOf(NotFoundException.class);
        assertThat(formService.getPublic(form.getId(), "9.9.9.9", "test-ua")).isNotNull();
    }

    @Test
    @DisplayName("남의 규칙은 삭제할 수 없다(존재도 알리지 않는다)")
    void cannotDeleteOthersRule() {
        Long id = service.add(owner.getId(), new IpBlockRequest("1.2.3.4", null)).id();
        assertThatThrownBy(() -> service.delete(other.getId(), id))
                .isInstanceOf(NotFoundException.class);
        assertThat(service.list(owner.getId())).hasSize(1);
    }

    @Test
    @DisplayName("차단되면 시도 로그가 남는다 — 어떤 규칙에 어디서 걸렸는지")
    void recordsHit() {
        service.add(owner.getId(), new IpBlockRequest("1.2.3.0/24", "경쟁사 대역"));

        assertThatThrownBy(() -> landingService.getPublicBySite("siteblock-a", "open", "1.2.3.9", "bot/1.0"))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> formService.getPublic(form.getId(), "1.2.3.9", "bot/1.0"))
                .isInstanceOf(NotFoundException.class);

        var hits = service.hits(owner.getId());
        assertThat(hits).hasSize(2);
        assertThat(hits).allSatisfy(h -> {
            assertThat(h.ip()).isEqualTo("1.2.3.9");
            assertThat(h.matchedPattern()).isEqualTo("1.2.3.0/24"); // 걸린 규칙이 무엇인지
            assertThat(h.userAgent()).isEqualTo("bot/1.0");
        });
        assertThat(hits).extracting(r -> r.source()).containsExactlyInAnyOrder("LANDING", "FORM");
    }

    @Test
    @DisplayName("차단되지 않으면 로그도 남지 않는다")
    void noHitWhenAllowed() {
        service.add(owner.getId(), new IpBlockRequest("1.2.3.4", null));
        assertThat(landingService.getPublicBySite("siteblock-a", "open", "9.9.9.9", "ua")).isNotNull();
        assertThat(service.hits(owner.getId())).isEmpty();
    }

    @Test
    @DisplayName("로그는 계정별로 분리되고 비울 수 있다")
    void hitsIsolatedAndClearable() {
        service.add(owner.getId(), new IpBlockRequest("1.2.3.4", null));
        assertThatThrownBy(() -> formService.getPublic(form.getId(), "1.2.3.4", "ua"))
                .isInstanceOf(NotFoundException.class);

        assertThat(service.hits(owner.getId())).hasSize(1);
        assertThat(service.hits(other.getId())).isEmpty(); // 남의 로그는 안 보인다

        service.clearHits(owner.getId());
        assertThat(service.hits(owner.getId())).isEmpty();
    }

    private User marketer(String email, String sub) {
        User u = new User(email, passwordEncoder.encode("pw12345678"), "마케터", null);
        u.setSubdomain(sub);
        return u;
    }
}
