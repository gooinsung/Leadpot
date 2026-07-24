package com.leadpot.stats;

import java.util.List;

/** 통계 집계 응답(기간·대상 필터 반영). 유입(방문)·접수(리드)·전환율 포함. */
public record StatsResponse(
        String from,               // 조회 시작일(YYYY-MM-DD, KST)
        String to,                 // 조회 종료일(포함, YYYY-MM-DD, KST)
        Summary summary,
        List<DayPoint> byDay,      // 일별 방문/리드
        List<Count> byDevice,      // 기기(리드 기준)
        List<Count> byOs,
        List<Count> byBrowser,
        List<Count> byUtmSource,
        List<Count> byUtmMedium,
        List<Count> byUtmCampaign,
        List<Count> byReferer,     // 유입 경로(호스트) 상위
        List<Count> byStatus,      // 리드 상태 분포(신규/상담중/완료/불량)
        List<EntityCount> byLanding,
        List<EntityCount> byForm) {

    /** 요약 지표. conversionRate = 리드/방문 * 100 (방문 0이면 0). */
    public record Summary(long visits, long leads, double conversionRate) {
    }

    public record DayPoint(String date, long visits, long leads) {
    }

    public record Count(String key, long count) {
    }

    public record EntityCount(Long id, String name, long visits, long leads, double conversionRate) {
    }
}
