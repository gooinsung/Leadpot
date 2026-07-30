package com.leadpot.advertiser.dto;

import java.time.Instant;

import com.leadpot.advertiser.AdvertiserInvite;

/**
 * 초대 발급/재발급 응답.
 * <p>
 * {@code token} 은 <b>발급 시점에만</b> 값이 들어온다(DB에는 해시만 저장하므로 이후 다시 볼 수 없다).
 * 목록 조회 응답에서는 null 이고, 링크를 다시 받으려면 재발급해야 한다.
 */
public record InviteResponse(
        Long id,
        String email,
        String name,
        String company,
        String token,
        Instant expiresAt,
        Instant acceptedAt,
        Instant createdAt) {

    /** 발급 직후 — 토큰 원문 포함. */
    public static InviteResponse issued(AdvertiserInvite invite, String token) {
        return new InviteResponse(invite.getId(), invite.getEmail(), invite.getName(), invite.getCompany(),
                token, invite.getExpiresAt(), invite.getAcceptedAt(), invite.getCreatedAt());
    }

    /** 목록 조회 — 토큰 없음. */
    public static InviteResponse of(AdvertiserInvite invite) {
        return new InviteResponse(invite.getId(), invite.getEmail(), invite.getName(), invite.getCompany(),
                null, invite.getExpiresAt(), invite.getAcceptedAt(), invite.getCreatedAt());
    }
}
