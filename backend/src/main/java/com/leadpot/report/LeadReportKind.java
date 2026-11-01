package com.leadpot.report;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/**
 * 리포트 종류와 집계 구간(서울 시각). 구간은 반열림 [from, to).
 *
 * <ul>
 * <li>{@link #MORNING} — 매일 09시: <b>오늘 00:00~09:00</b>(자는 동안 들어온 리드). 비교: 전날 같은 시간대</li>
 * <li>{@link #DAILY} — 매일 00시: <b>어제 00:00~24:00</b>(하루 전체). 비교: 그 전날 하루</li>
 * </ul>
 */
public enum LeadReportKind {
    MORNING,
    DAILY;

    public static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final LocalTime MORNING_END = LocalTime.of(9, 0);

    /** 집계 구간. {@code from}·{@code to} 는 서울 시각. */
    public record Window(ZonedDateTime from, ZonedDateTime to) {

        /** 같은 길이로 하루 앞선 비교 구간. */
        public Window previousDay() {
            return new Window(from.minusDays(1), to.minusDays(1));
        }
    }

    /**
     * {@code now} 시점에 <b>가장 최근에 끝난</b> 구간. 스케줄 실행(09:00·00:00 정각)이면 방금 끝난 구간이고,
     * 화면 미리보기에서 부르면 마지막으로 발송됐을(될) 구간이다.
     */
    public Window latestWindow(ZonedDateTime now) {
        ZonedDateTime local = now.withZoneSameInstant(KST);
        LocalDate today = local.toLocalDate();
        if (this == DAILY) {
            ZonedDateTime end = today.atStartOfDay(KST);
            return new Window(end.minusDays(1), end);
        }
        // 09시 전이면 아직 오늘 구간이 안 끝났다 → 어제 00~09시.
        LocalDate day = local.toLocalTime().isBefore(MORNING_END) ? today.minusDays(1) : today;
        return new Window(day.atStartOfDay(KST), day.atTime(MORNING_END).atZone(KST));
    }
}
