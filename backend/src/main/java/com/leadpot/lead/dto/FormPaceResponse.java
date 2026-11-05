package com.leadpot.lead.dto;

import java.util.List;

/**
 * 대시보드 '리드폼별 오늘 추이'(2026-11-05 사용자 요청) — {@link LeadPaceResponse} 를 리드폼 단위로 쪼갠 것.
 * 같은 시간대 비교(00:00 ~ 지금 시각)에 더해, 하루 전체 기준(어제 하루·최근 N일 하루 평균)도 같이 내린다.
 *
 * @param asOf      기준 시각(KST, "HH:mm")
 * @param usualDays 평균을 낸 일수(어제부터 거슬러 올라감, 오늘 제외)
 * @param items     최근 N일 또는 오늘 접수가 1건이라도 있는 리드폼만. 오늘 접수 많은 순.
 */
public record FormPaceResponse(String asOf, int usualDays, List<Item> items) {

    /**
     * @param today         오늘 00:00 ~ 지금
     * @param yesterday     어제 00:00 ~ 어제 같은 시각
     * @param usual         최근 N일 같은 시간대 누적의 일평균(소수 1자리)
     * @param yesterdayTotal 어제 하루 전체
     * @param dailyAvg      최근 N일 하루 전체의 일평균(소수 1자리)
     * @param weekTotal     최근 N일 합계(오늘 제외)
     */
    public record Item(Long formId, String formName, long today, long yesterday, double usual,
            long yesterdayTotal, double dailyAvg, long weekTotal) {
    }
}
