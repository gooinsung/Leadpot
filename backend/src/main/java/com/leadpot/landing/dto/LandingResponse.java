package com.leadpot.landing.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.leadpot.landing.LandingPage;

/** 랜딩 상세 응답(편집용). */
public record LandingResponse(
        Long id,
        String title,
        String slug,
        List<Map<String, Object>> content,
        String status,
        Map<String, Object> tracking,
        Instant createdAt,
        Instant updatedAt) {

    public static LandingResponse from(LandingPage l) {
        return new LandingResponse(
                l.getId(), l.getTitle(), l.getSlug(), l.getContent(), l.getStatus(), l.getTracking(),
                l.getCreatedAt(), l.getUpdatedAt());
    }
}
