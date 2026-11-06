package com.leadpot.lead.dto;

/**
 * 외부 API 전달 '미전송 일괄 전송'(2026-11-06) 응답.
 *
 * @param total     조회 시점의 미전송 건수(전송 요청이면 이번에 큐에 넣은 건 포함)
 * @param queued    이번에 전송 대기(PENDING)로 넣은 건수 — 조회만 할 때는 0
 * @param remaining 아직 남은 미전송 건수(한 번에 보내는 상한을 넘었을 때 0 보다 크다)
 */
public record OutboundUnsentResponse(long total, int queued, long remaining) {
}
