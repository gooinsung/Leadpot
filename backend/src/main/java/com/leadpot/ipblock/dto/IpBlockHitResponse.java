package com.leadpot.ipblock.dto;

import java.time.Instant;

import com.leadpot.ipblock.IpBlockHit;

/** 차단 접속(제출 시도) 로그 응답. */
public record IpBlockHitResponse(Long id, String ip, String matchedPattern, String userAgent,
        String referer, Instant createdAt) {

    public static IpBlockHitResponse from(IpBlockHit h) {
        return new IpBlockHitResponse(h.getId(), h.getIp(), h.getMatchedPattern(),
                h.getUserAgent(), h.getReferer(), h.getCreatedAt());
    }
}
