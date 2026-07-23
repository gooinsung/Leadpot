package com.leadpot.auth.dto;

import jakarta.validation.constraints.NotBlank;

/** 액세스 토큰 재발급 요청. */
public record RefreshRequest(
        @NotBlank String refreshToken) {
}
