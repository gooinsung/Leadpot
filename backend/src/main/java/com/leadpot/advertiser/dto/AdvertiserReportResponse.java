package com.leadpot.advertiser.dto;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadStatuses;

/**
 * 처리속도 리포트. 기간 내 리드에 대한 응답성 지표(광고주 화면=폼 1개, 마케터 화면=광고주의 여러 폼 합산 공용).
 * <ul>
 * <li>{@code avgSecondsToSeen} — 접수→최초 열람 평균(초). 열람한 리드 대상. null=열람 이력 없음.</li>
 * <li>{@code avgSecondsToStatus} — 접수→상태 변경 평균(초). 상태를 바꾼 리드 대상. null=변경 이력 없음.</li>
 * <li>{@code unseenRate} — 미확인 비율(0~1).</li>
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
        Long avgSecondsToSeen,
        Long avgSecondsToStatus,
        List<StatusCount> statusCounts) {

    /** 상태별 건수(라벨·코드·건수). 화면 표·색상에 쓴다. */
    public record StatusCount(String status, String label, int count) {
    }

    /**
     * 주어진 리드로 리포트를 계산한다. 날짜 필터는 <b>호출자가 이미 적용</b>했다고 본다
     * ({@code from}/{@code to} 는 화면 표기용으로 그대로 담는다).
     *
     * @param customNames 커스텀 상태 id → 이름(통합 축 V29). 상태 분포 표의 라벨에 쓴다.
     */
    public static AdvertiserReportResponse from(List<Lead> leads, Long formId, String name, String from, String to,
            Map<Long, String> customNames) {
        int total = leads.size();
        long seenSum = 0;
        int seenN = 0;
        long statusSum = 0;
        int statusN = 0;

        // 고정 상태를 정의 순서대로 0 으로 초기화(빈 상태도 표에 보이게). 커스텀은 등장 순서대로 뒤에 붙는다.
        Map<String, Integer> counts = new LinkedHashMap<>();
        Map<String, String> labels = new LinkedHashMap<>();
        for (Map.Entry<String, String> e : LeadStatuses.FIXED_LABELS.entrySet()) {
            counts.put(e.getKey(), 0);
            labels.put(e.getKey(), e.getValue());
        }
        for (Lead l : leads) {
            String key = l.statusKey();
            counts.merge(key, 1, Integer::sum);
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
        }
        int seen = seenN;
        int unseen = total - seen;
        double unseenRate = total == 0 ? 0 : (double) unseen / total;
        Long avgSeen = seenN > 0 ? seenSum / seenN : null;
        Long avgStatus = statusN > 0 ? statusSum / statusN : null;

        List<StatusCount> statusCounts = counts.entrySet().stream()
                .map(e -> new StatusCount(e.getKey(), labels.getOrDefault(e.getKey(), e.getKey()), e.getValue()))
                .toList();

        return new AdvertiserReportResponse(formId, name, from, to, total, seen, unseen, unseenRate,
                avgSeen, avgStatus, statusCounts);
    }
}
