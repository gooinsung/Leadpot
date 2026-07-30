package com.leadpot.advertiser.dto;

/** 재설정 링크를 열었을 때 보여줄 정보(비로그인 공개). 최소한만 담는다. */
public record PasswordResetInfoResponse(
        String email,
        String marketerName,
        String marketerCompany) {
}
