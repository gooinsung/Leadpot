package com.leadpot.advertiser.dto;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadAsRequest;
import com.leadpot.lead.LeadStatuses;

/**
 * 처리속도 리포트. 기간 내 리드에 대한 응답성 지표(광고주 화면=폼 1개, 마케터 화면=광고주의 여러 폼 합산 공용).
 * <ul>
 * <li>{@code avgSecondsToSeen} — 접수→최초 열람 평균(초). 열람한 리드 대상. null=열람 이력 없음.</li>
 * <li>{@code avgSecondsToStatus} — 접수→상태 변경 평균(초). 상태를 바꾼 리드 대상. null=변경 이력 없음.</li>
 * <li>{@code unseenRate} — 미확인 비율(0~1).</li>
 * <li>{@code converted}/{@code validRate} — <b>접수 대비 유효 비율</b>({@code converted} =
 *     상태가 {@link LeadStatuses#VALID 유효}인 리드 수, 사용자 확정 2026-08-11).
 *     ⚠️ 자동 승인이 켜진 리드폼은 신규→유효가 자동이라 이 값이 높게 나온다 —
 *     "계약 성사율"이 아니라 <b>받은 DB 중 유효 과금 대상 비율</b>로 읽어야 한다.
 *     ⚠️ 필드명이 원래 {@code conversionRate}였다가 2026-08-20 {@code validRate}로 바뀌었다 —
 *     "전환"은 마케터 입장(신규→유효)의 말이고, 광고주 입장에서 진짜 전환(수임 완료 등)은
 *     이 서비스가 알지 못하는 값이라 오해를 살 수 있어서다(사용자 확정).</li>
 * </ul>
 * "첫 상태변경"이 아니라 광고주가 남긴 <b>상태변경 시각</b> 기준이다(대부분 1회라 실질 동일).
 */
public record AdvertiserReportResponse(
        Long formId,
        String formName,
        String from,
        String to,
        int total,
        int seen,
        int unseen,
        double unseenRate,
        int converted,
        double validRate,
        Long avgSecondsToSeen,
        Long avgSecondsToStatus,
        List<StatusCount> statusCounts,
        List<DailyCount> dailyCounts,
        AsStats asStats) {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter DAY_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(KST);

    /** 상태별 건수(라벨·코드·건수). 화면 표·색상에 쓴다. */
    public record StatusCount(String status, String label, int count) {
    }

    /** 일별 접수 건수(날짜순, KST 기준 yyyy-MM-dd). 접수가 없는 날은 만들지 않는다(빈 막대 X). */
    public record DailyCount(String date, int count) {
    }

    /**
     * AS 요청 통계 — 이 리포트가 다루는 리드들에 걸린 AS 요청 전부를 상태별로 센다.
     * 리드 한 건에 요청이 여러 번(거부 후 재요청) 있을 수 있어 {@code total} 은 리드 수가 아니라 요청 건수다.
     */
    public record AsStats(int total, int open, int accepted, int rejected) {
        static final AsStats EMPTY = new AsStats(0, 0, 0, 0);
    }

    /**
     * 주어진 리드로 리포트를 계산한다. 날짜 필터는 <b>호출자가 이미 적용</b>했다고 본다
     * ({@code from}/{@code to} 는 화면 표기용으로 그대로 담는다).
     *
     * @param customNames 커스텀 상태 id → 이름(통합 축 V29). 상태 분포 표의 라벨에 쓴다.
     * @param asRequests  이 리포트가 다루는 리드들에 걸린 AS 요청 전부(호출자가 leadId 로 조회해 넘긴다).
     */
    public static AdvertiserReportResponse from(List<Lead> leads, List<LeadAsRequest> asRequests, Long formId,
            String name, String from, String to, Map<Long, String> customNames) {
        int total = leads.size();
        long seenSum = 0;
        int seenN = 0;
        long statusSum = 0;
        int statusN = 0;
        int converted = 0;

        // 고정 상태를 정의 순서대로 0 으로 초기화(빈 상태도 표에 보이게). 커스텀은 등장 순서대로 뒤에 붙는다.
        Map<String, Integer> counts = new LinkedHashMap<>();
        Map<String, String> labels = new LinkedHashMap<>();
        for (Map.Entry<String, String> e : LeadStatuses.FIXED_LABELS.entrySet()) {
            counts.put(e.getKey(), 0);
            labels.put(e.getKey(), e.getValue());
        }
        // 날짜순 정렬을 위해 TreeMap(문자열 yyyy-MM-dd 는 사전순=날짜순).
        Map<String, Integer> daily = new TreeMap<>();
        for (Lead l : leads) {
            String key = l.statusKey();
            counts.merge(key, 1, Integer::sum);
            if (LeadStatuses.VALID.equals(l.getStatus())) {
                converted++;
            }
            labels.putIfAbsent(key, LeadStatuses.label(l.getStatus(),
                    l.getCustomStatusId() == null ? null : customNames.get(l.getCustomStatusId())));
            Instant created = l.getCreatedAt();
            if (created != null && l.getAdvertiserSeenAt() != null) {
                seenSum += Math.max(0, Duration.between(created, l.getAdvertiserSeenAt()).getSeconds());
                seenN++;
            }
            if (created != null && l.getStatusChangedAt() != null) {
                statusSum += Math.max(0, Duration.between(created, l.getStatusChangedAt()).getSeconds());
                statusN++;
            }
            if (created != null) {
                daily.merge(DAY_FMT.format(created), 1, Integer::sum);
            }
        }
        int seen = seenN;
        int unseen = total - seen;
        double unseenRate = total == 0 ? 0 : (double) unseen / total;
        double validRate = total == 0 ? 0 : (double) converted / total;
        Long avgSeen = seenN > 0 ? seenSum / seenN : null;
        Long avgStatus = statusN > 0 ? statusSum / statusN : null;

        List<StatusCount> statusCounts = counts.entrySet().stream()
                .map(e -> new StatusCount(e.getKey(), labels.getOrDefault(e.getKey(), e.getKey()), e.getValue()))
                .toList();
        List<DailyCount> dailyCounts = daily.entrySet().stream()
                .map(e -> new DailyCount(e.getKey(), e.getValue()))
                .toList();
        AsStats asStats = asRequests.isEmpty() ? AsStats.EMPTY : summarizeAs(asRequests);

        return new AdvertiserReportResponse(formId, name, from, to, total, seen, unseen, unseenRate,
                converted, validRate, avgSeen, avgStatus, statusCounts, dailyCounts, asStats);
    }

    private static AsStats summarizeAs(List<LeadAsRequest> asRequests) {
        int open = 0;
        int accepted = 0;
        int rejected = 0;
        for (LeadAsRequest r : asRequests) {
            switch (r.getStatus()) {
                case LeadAsRequest.STATUS_OPEN -> open++;
                case LeadAsRequest.STATUS_ACCEPTED -> accepted++;
                case LeadAsRequest.STATUS_REJECTED -> rejected++;
                default -> {
                    // 알 수 없는 상태값 — 방어적으로 무시(집계 총합은 total 이 아니라 개별 합이 기준).
                }
            }
        }
        return new AsStats(asRequests.size(), open, accepted, rejected);
    }
}
