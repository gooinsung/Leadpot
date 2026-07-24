package com.leadpot.stats;

import java.util.List;

/** 통계 집계 응답. */
public record StatsResponse(
        long total,
        List<Count> byDay,      // 최근 30일 일별
        List<Count> byDevice,   // 기기(PC/MOBILE/TABLET)
        List<Count> byUtmSource,// UTM source
        List<Count> byReferer,  // 유입 경로(호스트) 상위
        List<FormCount> byForm) {

    public record Count(String key, long count) {
    }

    public record FormCount(Long formId, String name, long count) {
    }
}
