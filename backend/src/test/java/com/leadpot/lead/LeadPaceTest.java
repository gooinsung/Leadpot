package com.leadpot.lead;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.leadpot.lead.dto.LeadPaceResponse;

/** 대시보드 '접수 페이스' 계산 — 같은 시간대(00:00~지금 시각)만 세는지, KST 날짜 경계가 맞는지. */
class LeadPaceTest {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final ZonedDateTime NOW = ZonedDateTime.of(2026, 11, 4, 14, 30, 0, 0, KST);

    private static Instant at(int daysAgo, int h, int m) {
        return NOW.toLocalDate().minusDays(daysAgo).atTime(h, m).atZone(KST).toInstant();
    }

    @Test
    @DisplayName("오늘·어제·평상시 모두 00:00~지금 시각 구간만 센다")
    void countsSameTimeWindow() {
        List<Instant> list = List.of(
                at(0, 0, 5), at(0, 9, 0), at(0, 14, 30),      // 오늘 3건(지금 시각 포함)
                at(1, 10, 0), at(1, 14, 29), at(1, 14, 31),   // 어제: 14:31 은 제외 → 2건
                at(2, 8, 0), at(2, 23, 0),                     // 그제: 23:00 제외 → 1건
                at(7, 1, 0),                                   // 7일 전: 1건(평균에 포함)
                at(8, 1, 0));                                  // 8일 전: 범위 밖

        LeadPaceResponse r = LeadService.computePace(list, NOW, 7);

        assertThat(r.today()).isEqualTo(3);
        assertThat(r.yesterday()).isEqualTo(2);
        assertThat(r.usual()).isEqualTo(0.6); // (2+1+1)/7 = 0.571.. → 0.6
        assertThat(r.usualDays()).isEqualTo(7);
        assertThat(r.asOf()).isEqualTo("14:30");
    }

    @Test
    @DisplayName("UTC 로는 전날이어도 KST 기준 날짜로 묶는다")
    void usesKstDayBoundary() {
        // KST 오늘 00:30 = UTC 어제 15:30
        LeadPaceResponse r = LeadService.computePace(List.of(at(0, 0, 30)), NOW, 7);
        assertThat(r.today()).isEqualTo(1);
        assertThat(r.yesterday()).isZero();
    }
}
