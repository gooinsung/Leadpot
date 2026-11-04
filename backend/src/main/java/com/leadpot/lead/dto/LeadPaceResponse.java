package com.leadpot.lead.dto;

/**
 * 대시보드 '접수 페이스' — 오늘 지금 시각까지 들어온 접수를 같은 시간대와 비교(2026-11-04 사용자 요청).
 * 모든 구간은 KST 00:00 ~ (그날의) 지금 시각과 같은 시:분 까지의 누적 접수 수.
 *
 * @param today     오늘 00:00 ~ 지금
 * @param yesterday 어제 00:00 ~ 어제 같은 시각
 * @param usual     최근 {@code usualDays}일(어제 포함, 오늘 제외) 같은 시간대 누적의 일평균
 * @param usualDays 평상시 평균을 낸 일수
 * @param asOf      기준 시각(KST, "HH:mm")
 */
public record LeadPaceResponse(long today, long yesterday, double usual, int usualDays, String asOf) {
}
