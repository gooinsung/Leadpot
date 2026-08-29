package com.leadpot.stats;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.event.InteractionEvent;
import com.leadpot.event.InteractionEventRepository;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormType;
import com.leadpot.visit.Visit;
import com.leadpot.visit.VisitRepository;

/**
 * 고객 여정 분석(I6) 검증 — 스크롤 깊이별 도달률, 평균 체류 시간, 즉시 이탈률.
 */
@SpringBootTest
@Transactional
class StatsJourneyTest {

    @Autowired
    private StatsService statsService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private VisitRepository visitRepository;
    @Autowired
    private InteractionEventRepository eventRepository;

    private User owner;
    private Form form;

    @BeforeEach
    void setUp() {
        owner = userRepository.save(new User("stats-journey@test.local", "{noop}x", "통계", null));
        form = formRepository.save(new Form(owner.getId(), "여정 폼", FormType.BASIC));

        // 순방문 4명(ip-a~d)
        saveVisit("ip-a");
        saveVisit("ip-b");
        saveVisit("ip-c");
        saveVisit("ip-d");

        // ip-a: 100%까지 스크롤 + 42초 체류 후 이탈
        saveScroll("ip-a", 25);
        saveScroll("ip-a", 50);
        saveScroll("ip-a", 75);
        saveScroll("ip-a", 100);
        saveExit("ip-a", 42);

        // ip-b: 50%까지만 스크롤 + 18초 체류 후 이탈
        saveScroll("ip-b", 25);
        saveScroll("ip-b", 50);
        saveExit("ip-b", 18);

        // ip-c, ip-d: 스크롤 이벤트 없음(즉시 이탈)
    }

    @Test
    @DisplayName("스크롤 깊이별 도달률 + 평균 체류시간 + 즉시 이탈률")
    void journeyAggregation() {
        StatsResponse r = statsService.overview(owner.getId(), null, null, null, null);
        StatsResponse.Journey j = r.journey();

        assertThat(j.sessions()).isEqualTo(4);

        StatsResponse.ScrollPoint p25 = pointAt(j, 25);
        StatsResponse.ScrollPoint p50 = pointAt(j, 50);
        StatsResponse.ScrollPoint p75 = pointAt(j, 75);
        StatsResponse.ScrollPoint p100 = pointAt(j, 100);

        assertThat(p25.reached()).isEqualTo(2); // ip-a, ip-b
        assertThat(p25.rate()).isEqualTo(50.0);
        assertThat(p50.reached()).isEqualTo(2);
        assertThat(p75.reached()).isEqualTo(1); // ip-a 만
        assertThat(p100.reached()).isEqualTo(1);

        // 평균 체류시간 = (42+18)/2 = 30초
        assertThat(j.avgDurationSec()).isEqualTo(30.0);

        // 즉시 이탈률 = 25% 도달 못한 방문자(ip-c, ip-d)/전체 4 = 50%
        assertThat(j.bounceRate()).isEqualTo(50.0);
    }

    private StatsResponse.ScrollPoint pointAt(StatsResponse.Journey j, int depth) {
        return j.scrollFunnel().stream().filter(p -> p.depth() == depth).findFirst().orElseThrow();
    }

    private void saveVisit(String ipHash) {
        Visit v = new Visit();
        v.setOwnerId(owner.getId());
        v.setFormId(form.getId());
        v.setIpHash(ipHash);
        visitRepository.save(v);
    }

    private void saveScroll(String ipHash, int depth) {
        InteractionEvent e = new InteractionEvent();
        e.setOwnerId(owner.getId());
        e.setFormId(form.getId());
        e.setEventType("scroll");
        e.setScrollDepth(depth);
        e.setIpHash(ipHash);
        eventRepository.save(e);
    }

    private void saveExit(String ipHash, int durationSec) {
        InteractionEvent e = new InteractionEvent();
        e.setOwnerId(owner.getId());
        e.setFormId(form.getId());
        e.setEventType("page_exit");
        e.setDurationSec(durationSec);
        e.setIpHash(ipHash);
        eventRepository.save(e);
    }
}
