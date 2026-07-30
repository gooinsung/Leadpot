package com.leadpot.advertiser.dto;

import java.time.Instant;

/** 마케터의 광고주 목록 항목. */
public record AdvertiserSummary(
        Long id,
        String email,
        String name,
        String company,
        String memo,
        boolean active,
        long grantCount,
        Instant lastLoginAt,
        Instant createdAt) {
}
