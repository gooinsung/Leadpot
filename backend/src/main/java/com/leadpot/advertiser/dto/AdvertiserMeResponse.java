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
        String brandColor,
        /**
         * 내가 등록한 <b>계정 기본</b> 접수 알림 수신번호(V33). 없으면 빈 문자열.
         * 배정된 모든 리드폼에 적용되고, 폼 전용 번호가 있는 폼만 그 값이 우선한다.
         */
        String notifyPhone) {
}
