package com.leadpot.stats;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormType;
import com.leadpot.form.LeadValues;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;
import com.leadpot.lead.LeadStatuses;

/**
 * 리드당 가치 → 수익 집계(V44). 도장 값 우선, 도장 없는(기능 도입 전) 리드는 폼의 현재 단가,
 * 상태 무관(무효 포함) — 2026-09-27 사용자 확정.
 */
@SpringBootTest
@Transactional
class StatsRevenueTest {

    @Autowired
    private StatsService statsService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private LeadRepository leadRepository;

    private User owner;
    private Form formA;
    private Form formB;

    @BeforeEach
    void setUp() {
        owner = userRepository.save(new User("stats-revenue@test.local", "{noop}x", "수익", null));
        formA = new Form(owner.getId(), "A 폼", FormType.BASIC);
        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put(LeadValues.KEY, 20000); // 현재 단가 2만원(과거엔 1만원이었다고 가정)
        formA.setSettingsConfig(settings);
        formA = formRepository.save(formA);
        formB = formRepository.save(new Form(owner.getId(), "B 폼(단가 없음)", FormType.BASIC));

        saveLead(formA, 10000L, 7L, null);                 // 1만원 시절 접수 — 도장 1만원
        saveLead(formA, 10000L, 7L, LeadStatuses.INVALID); // 무효여도 센다
        saveLead(formA, null, null, null);                 // 기능 도입 전 리드 → 현재 단가 2만원
        saveLead(formB, null, 7L, null);                   // 단가 없음 → 0원
    }

    @Test
    @DisplayName("통계 요약·리드폼별·랜딩별 수익")
    void overviewRevenue() {
        StatsResponse r = statsService.overview(owner.getId(), null, null, null, null, null, null);
        assertThat(r.summary().revenue()).isEqualTo(40000);
        assertThat(r.byDay().stream().mapToLong(StatsResponse.DayPoint::revenue).sum()).isEqualTo(40000);
        assertThat(r.byForm()).filteredOn(e -> formA.getId().equals(e.id()))
                .singleElement().satisfies(e -> assertThat(e.revenue()).isEqualTo(40000));
        assertThat(r.byLanding()).filteredOn(e -> Long.valueOf(7L).equals(e.id()))
                .singleElement().satisfies(e -> assertThat(e.revenue()).isEqualTo(20000));

        // 리드폼 필터 → 그 폼의 수익만
        StatsResponse onlyB = statsService.overview(owner.getId(), null, null, null, formB.getId(), null, null);
        assertThat(onlyB.summary().revenue()).isZero();
    }

    @Test
    @DisplayName("수익 요약 API — 합계·폼별·랜딩별")
    void revenueSummary() {
        StatsResponse.Revenue r = statsService.revenue(owner.getId(), null, null);
        assertThat(r.leads()).isEqualTo(4);
        assertThat(r.revenue()).isEqualTo(40000);
        assertThat(r.byForm()).filteredOn(x -> formA.getId().equals(x.id()))
                .singleElement().satisfies(x -> {
                    assertThat(x.leads()).isEqualTo(3);
                    assertThat(x.revenue()).isEqualTo(40000);
                });
        assertThat(r.byLanding()).filteredOn(x -> x.id() == null)
                .singleElement().satisfies(x -> assertThat(x.revenue()).isEqualTo(20000));
    }

    @Test
    @DisplayName("단가 파싱: 숫자·문자열(쉼표·원)·0 이하·잘못된 값")
    void parseLeadValue() {
        assertThat(LeadValues.of(Map.of(LeadValues.KEY, 15000))).isEqualTo(15000L);
        assertThat(LeadValues.of(Map.of(LeadValues.KEY, "15,000원"))).isEqualTo(15000L);
        assertThat(LeadValues.of(Map.of(LeadValues.KEY, 0))).isNull();
        assertThat(LeadValues.of(Map.of(LeadValues.KEY, "abc"))).isNull();
        assertThat(LeadValues.of(Map.of())).isNull();
        assertThat(LeadValues.of(null)).isNull();
    }

    private void saveLead(Form form, Long value, Long landingId, String status) {
        Lead l = new Lead();
        l.setFormId(form.getId());
        l.setLandingPageId(landingId);
        l.setAnswers(List.of(Map.of("label", "이름", "value", "t")));
        l.setLeadValue(value);
        if (status != null) {
            l.changeStatus(status, null, java.time.Instant.now());
        }
        leadRepository.save(l);
    }
}
