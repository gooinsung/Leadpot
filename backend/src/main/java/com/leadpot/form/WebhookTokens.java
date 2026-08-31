package com.leadpot.form;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * 웹훅 수신 URL 토큰 생성/해시. {@code com.leadpot.advertiser.InviteTokens} 와 같은 원칙 —
 * 토큰 원문은 DB에 저장하지 않고 SHA-256 해시만 보관한다. URL 자체가 인증 수단이므로
 * 추측 불가능한 난수(256비트)를 쓴다. (초대 토큰과 달리 1회성이 아니라 마케터가 외부 도구에
 * 등록해 계속 쓰는 값이라 — 노출 시 재발급으로 무효화한다.)
 */
public final class WebhookTokens {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();

    private WebhookTokens() {
    }

    /** URL 안전한 43자 토큰(256비트). */
    public static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return ENCODER.encodeToString(bytes);
    }

    /**
     * 조회/비교용 SHA-256 hex(64자). public — 공개 웹훅 수신 경로({@code com.leadpot.lead.webhook})가
     * 요청 URL 의 토큰을 같은 방식으로 해시해 조회해야 해서 패키지 밖에서도 필요하다.
     */
    public static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 을 사용할 수 없습니다.", e);
        }
    }
}
