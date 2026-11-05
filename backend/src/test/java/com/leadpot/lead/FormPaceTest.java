package com.leadpot.lead;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.leadpot.lead.LeadService.FormHit;
import com.leadpot.lead.dto.FormPaceResponse;

/** 대시보드 '리드폼별 오늘 추이' 계산 — 리드폼별로 같은 시간대·하루 전체를 따로 세는지. */
class FormPaceTest {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final ZonedDateTime NOW = ZonedDateTime.of(2026, 11, 5, 14, 30, 0, 0, KST);

    private static FormHit hit(long formId, int daysAgo, int h, int m) {
        return new FormHit(formId, "폼" + formId,
                NOW.toLocalDate().minusDays(daysAgo).atTime(h, m).atZone(KST).toInstant());
    }

    @Test
    @DisplayName("리드폼별로 오늘·어제 이시간·평상시 이시간·어제 하루·하루 평균을 센다")
    void perFormCounts() {
        List<FormHit> list = List.of(
                hit(1, 0, 9, 0), hit(1, 0, 14, 30),       // 폼1 오늘 2건
                hit(1, 1, 10, 0), hit(1, 1, 20, 0),       // 폼1 어제: 이시간 1, 하루 2
                hit(1, 3, 23, 0),                          // 폼1 3일 전 저녁: 하루 기준만
                hit(1, 8, 1, 0),                           // 범위 밖
                hit(2, 2, 8, 0), hit(2, 7, 9, 0));        // 폼2 오늘 0건

        FormPaceResponse r = LeadService.computeFormPace(list, NOW, 7);

        assertThat(r.asOf()).isEqualTo("14:30");
        assertThat(r.usualDays()).isEqualTo(7);
        assertThat(r.items()).hasSize(2);

        FormPaceResponse.Item f1 = r.items().get(0);
        assertThat(f1.formId()).isEqualTo(1L);
        assertThat(f1.formName()).isEqualTo("폼1");
        assertThat(f1.today()).isEqualTo(2);
        assertThat(f1.yesterday()).isEqualTo(1);
        assertThat(f1.usual()).isEqualTo(0.1);          // 1/7
        assertThat(f1.yesterdayTotal()).isEqualTo(2);
        assertThat(f1.weekTotal()).isEqualTo(3);
        assertThat(f1.dailyAvg()).isEqualTo(0.4);       // 3/7 = 0.43

        FormPaceResponse.Item f2 = r.items().get(1);
        assertThat(f2.today()).isZero();
        assertThat(f2.usual()).isEqualTo(0.3);          // 2/7 = 0.29
        assertThat(f2.weekTotal()).isEqualTo(2);
    }

    @Test
    @DisplayName("오늘 많이 들어온 리드폼이 먼저, 같으면 하루 평균 높은 순")
    void sortsByTodayThenAverage() {
        List<FormHit> list = new ArrayList<>();
        list.add(hit(10, 1, 9, 0));                               // 오늘 0, 평균 낮음
        for (int i = 1; i <= 7; i++) list.add(hit(20, i, 9, 0)); // 오늘 0, 평균 1
        list.add(hit(30, 0, 9, 0));                               // 오늘 1

        List<Long> order = LeadService.computeFormPace(list, NOW, 7).items().stream()
                .map(FormPaceResponse.Item::formId).toList();
        assertThat(order).containsExactly(30L, 20L, 10L);
    }

    @Test
    @DisplayName("지금 이후(미래) 시각은 오늘에도 하루 전체에도 넣지 않는다")
    void ignoresFuture() {
        FormPaceResponse r = LeadService.computeFormPace(List.of(hit(1, 0, 15, 0)), NOW, 7);
        assertThat(r.items()).isEmpty();
    }
}
