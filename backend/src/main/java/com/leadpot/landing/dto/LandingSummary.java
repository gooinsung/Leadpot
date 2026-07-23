package com.leadpot.landing.dto;

import java.time.Instant;

import com.leadpot.landing.LandingPage;

/** 랜딩 목록용 요약. */
public record LandingSummary(
        Long id,
        String title,
        String slug,
        String status,
        Instant updatedAt) {

    public static LandingSummary from(LandingPage l) {
        return new LandingSummary(l.getId(), l.getTitle(), l.getSlug(), l.getStatus(), l.getUpdatedAt());
    }
}
