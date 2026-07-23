package com.leadpot.auth.dto;

/** 인증 성공 응답: 토큰 + 계정 정보. */
public record TokenResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresIn,
        UserResponse user) {

    public static TokenResponse of(String accessToken, String refreshToken, long expiresIn, UserResponse user) {
        return new TokenResponse(accessToken, refreshToken, "Bearer", expiresIn, user);
    }
}
