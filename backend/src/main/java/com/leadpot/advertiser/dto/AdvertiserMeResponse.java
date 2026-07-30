package com.leadpot.advertiser.dto;

/**
 * 광고주 본인 정보 + 소속 마케터 브랜드(화이트라벨).
 * 마케터의 이메일·연락처 같은 정보는 담지 않는다.
 */
public record AdvertiserMeResponse(
        Long id,
        String email,
        String name,
        String company,
        String marketerName,
        String marketerCompany,
        String brandLogoUrl,
        String brandColor) {
}
