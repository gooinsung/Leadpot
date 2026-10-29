package com.leadpot.advertiser.dto;

import java.time.Instant;
import java.time.LocalDate;

/**
 * 광고주 정보 + 연결된 포털 계정 요약 + 견적 이력 요약(광고주 관리 목록용).
 * {@code accountEmail} 은 계정이 연결돼 있을 때만 채운다.
 */
public record AdvertiserProfileResponse(
        Long id,
        String companyName,
        String ceoName,
        String bizNo,
        String contactName,
        String phone,
        String email,
        String address,
        String memo,
        Long advertiserUserId,
        String accountEmail,
        long quoteCount,
        LocalDate lastQuoteDate,
        Instant updatedAt) {
}
