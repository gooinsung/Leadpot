package com.leadpot.advertiser.dto;

import com.leadpot.auth.User;

/**
 * 화이트라벨(마케터 브랜드) 설정 — 조회/저장 공용.
 * 광고주 화면 상단에 이 로고·색상이 표시된다({@code AdvertiserMeResponse} 로 광고주에게 전달).
 */
public record BrandSettings(String logoUrl, String color) {

    public static BrandSettings from(User marketer) {
        return new BrandSettings(marketer.getBrandLogoUrl(), marketer.getBrandColor());
    }
}
