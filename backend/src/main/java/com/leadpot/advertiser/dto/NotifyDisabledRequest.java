package com.leadpot.advertiser.dto;

/**
 * 리드폼별 접수 알림 끄기/켜기 요청(V33).
 *
 * <p>번호를 비우는 것과 다르다 — 비우면 계정 기본 번호를 따라가고, 이건 그 폼만 아예 끈다.
 */
public record NotifyDisabledRequest(boolean disabled) {
}
