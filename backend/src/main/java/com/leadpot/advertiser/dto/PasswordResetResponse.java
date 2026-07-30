package com.leadpot.advertiser.dto;

import java.time.Instant;

/** 재설정 링크 발급 응답. token 은 발급 시점에만 볼 수 있다(DB에는 해시만 저장). */
public record PasswordResetResponse(
        String email,
        String token,
        Instant expiresAt) {
}
