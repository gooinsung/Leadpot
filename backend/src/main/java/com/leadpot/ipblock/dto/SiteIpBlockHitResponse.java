package com.leadpot.ipblock.dto;

import java.time.Instant;

import com.leadpot.ipblock.SiteIpBlockHit;

/** 전역 접속 차단에 걸린 시도 로그 응답. */
public record SiteIpBlockHitResponse(Long id, String ip, String matchedPattern, String source,
        String sourceLabel, String userAgent, Instant createdAt) {

    public static SiteIpBlockHitResponse from(SiteIpBlockHit h) {
        return new SiteIpBlockHitResponse(h.getId(), h.getIp(), h.getMatchedPattern(), h.getSource(),
                label(h.getSource()), h.getUserAgent(), h.getCreatedAt());
    }

    private static String label(String source) {
        return switch (source) {
            case "LANDING" -> "랜딩 열람";
            case "FORM" -> "리드폼 열람";
            case "SUBMIT" -> "리드 제출";
            default -> source;
        };
    }
}
