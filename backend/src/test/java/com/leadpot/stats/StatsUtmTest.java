package com.leadpot.stats;

import static org.assertj.core.api.Assertions.assertThat;

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
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;
import com.leadpot.visit.Visit;
import com.leadpot.visit.VisitRepository;

/**
 * 통계 유입별 표(byUtmTables) + 유입 필터 검증 — 값별 방문·리드·전환율이 맞는지,
 * 필터가 요약까지 재계산하는지, "(없음)"(오가닉) 구분이 되는지.
 */
@SpringBootTest
@Transactional
class StatsUtmTest {

    @Autowired
    private StatsService statsService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private LeadRepository leadRepository;
    @Autowired
    private VisitRepository visitRepository;

    private User owner;
    private Form form;

    @BeforeEach
    void setUp() {
        owner = userRepository.save(new User("stats-utm@test.local", "{noop}x", "통계", null));
        form = formRepository.save(new Form(owner.getId(), "통계 폼", FormType.BASIC));
        // 방문: danggun 2건(고유 ip 2), meta 1건, 파라미터 없음 1건
        saveVisit(Map.of("media_from", "danggun"), "ip-a");
        saveVisit(Map.of("media_from", "danggun", "campaign_name", "summer"), "ip-b");
        saveVisit(Map.of("media_from", "meta"), "ip-c");
        saveVisit(null, "ip-d");
        // 리드: danggun 1건, 파라미터 없음 1건
        saveLead(Map.of("media_from", "danggun"));
        saveLead(null);
    }

    @Test
    @DisplayName("유입별 표: 값별 방문·리드·전환율 + (없음) 행")
    void utmTables() {
        StatsResponse r = statsService.overview(owner.getId(), null, null, null, null, null, null);
        StatsResponse.UtmTable media = r.byUtmTables().stream()
                .filter(t -> "media_from".equals(t.key())).findFirst().orElseThrow();

        StatsResponse.UtmRow danggun = media.rows().stream()
                .filter(x -> "danggun".equals(x.value())).findFirst().orElseThrow();
        assertThat(danggun.totalVisits()).isEqualTo(2);
        assertThat(danggun.uniqueVisits()).isEqualTo(2);
        assertThat(danggun.leads()).isEqualTo(1);
        assertThat(danggun.conversionRate()).isEqualTo(50.0);

        assertThat(media.rows()).extracting(StatsResponse.UtmRow::value)
                .contains("meta", "(없음)");
    }

    @Test
    @DisplayName("유입 필터: 요약(방문·리드)이 그 유입만으로 재계산된다. 표는 필터와 무관하게 전체")
    void utmFilterRecalculatesSummary() {
        StatsResponse r = statsService.overview(owner.getId(), null, null, null, null, "media_from", "danggun");
        assertThat(r.summary().totalVisits()).isEqualTo(2);
        assertThat(r.summary().leads()).isEqualTo(1);
        // 비교 표는 필터가 걸려도 전체 기준 — 행을 갈아탈 수 있어야 한다
        StatsResponse.UtmTable media = r.byUtmTables().stream()
                .filter(t -> "media_from".equals(t.key())).findFirst().orElseThrow();
        assertThat(media.rows()).extracting(StatsResponse.UtmRow::value).contains("meta");
    }

    private void saveVisit(Map<String, Object> utm, String ipHash) {
        Visit v = new Visit();
        v.setOwnerId(owner.getId());
        v.setFormId(form.getId());
        v.setUtm(utm);
        v.setIpHash(ipHash);
        visitRepository.save(v);
    }

    private void saveLead(Map<String, Object> utm) {
        Lead l = new Lead();
        l.setFormId(form.getId());
        l.setAnswers(List.of(Map.of("label", "이름", "value", "t")));
        l.setUtm(utm);
        leadRepository.save(l);
    }
}
