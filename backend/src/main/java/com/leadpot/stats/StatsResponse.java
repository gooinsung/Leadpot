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
        // 자체 광고 파라미터(광고 URL 빌더가 붙이는 3종) — 표준 UTM 과 병행 수집된다
        List<Count> byMediaFrom,      // media_from (광고 매체)
        List<Count> byCampaignName,   // campaign_name (캠페인 이름)
        List<Count> byAdsName,        // ads_name (광고 이름)
        List<Count> byReferer,     // 유입 경로(호스트) 상위
        List<Count> byStatus,      // 리드 상태 분포(신규/상담중/완료/불량)
        List<EntityCount> byLanding,
        List<EntityCount> byForm,
        /** 유입별 비교 표(자체 파라미터 3키) — 값별 방문·리드·전환율. 행 클릭 → 유입 필터. */
        List<UtmTable> byUtmTables,
        Funnel funnel,             // 전환 퍼널: 방문 → 폼 열기 → 접수 (I4)
        List<Count> byEvent) {     // 요소 클릭 집계(대상별 총 클릭 수) (I5)

    /**
     * 요약 지표.
     * uniqueVisits = 고유 방문(IP 해시 distinct), totalVisits = 총 트래픽(중복 포함 전체 접속).
     * conversionRate = 리드/순방문 * 100 (순방문 0이면 0).
     */
    public record Summary(long uniqueVisits, long totalVisits, long leads, double conversionRate) {
    }

    /** 일별: visits = 총 트래픽(중복 포함), leads = 접수. */
    public record DayPoint(String date, long visits, long leads) {
    }

    public record Count(String key, long count) {
    }

    public record EntityCount(Long id, String name, long uniqueVisits, long totalVisits, long leads,
            double conversionRate) {
    }

    /**
     * 유입 파라미터 한 키의 비교 표. key = media_from 등, rows = 값별 성과.
     * 방문(visits)에도 같은 파라미터가 저장되므로 값별 방문·전환율이 실제로 계산된다.
     * 파라미터 없이 들어온 것은 "(없음)" 행(오가닉/직접 유입 비교용).
     */
    public record UtmTable(String key, List<UtmRow> rows) {
    }

    public record UtmRow(String value, long uniqueVisits, long totalVisits, long leads, double conversionRate) {
    }

    /**
     * 전환 퍼널(고유 방문자 기준). visits = 순방문, formOpens = 폼 열기(고유), leads = 접수.
     * openRate = 폼열기/순방문 * 100(방문→폼열기), submitRate = 접수/폼열기 * 100(폼열기→접수).
     * (인라인 폼 랜딩·단독 리드폼은 '폼 열기' 단계가 없어 formOpens=0 일 수 있음.)
     */
    public record Funnel(long visits, long formOpens, long leads, double openRate, double submitRate) {
    }
}
