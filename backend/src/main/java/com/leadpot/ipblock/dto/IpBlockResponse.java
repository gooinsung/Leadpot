package com.leadpot.ipblock.dto;

import java.time.Instant;

import com.leadpot.ipblock.IpBlock;

/** IP 차단 규칙 응답. */
public record IpBlockResponse(Long id, String pattern, String reason, Instant createdAt) {

    public static IpBlockResponse from(IpBlock b) {
        return new IpBlockResponse(b.getId(), b.getPattern(), b.getReason(), b.getCreatedAt());
    }
}
