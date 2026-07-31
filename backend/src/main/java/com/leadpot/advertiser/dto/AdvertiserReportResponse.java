package com.leadpot.advertiser.dto;

import java.util.List;

/**
 * 광고주 처리속도 리포트. 기간 내 배정 리드에 대한 응답성 지표.
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
}
