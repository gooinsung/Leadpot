package com.leadpot.form.dto;

/** 웹훅 활성화/재발급 응답 — 토큰 원문이 담기는 유일한 응답(이후엔 해시만 남아 다시 보여줄 수 없다). */
public record WebhookTokenResponse(String token) {
}
