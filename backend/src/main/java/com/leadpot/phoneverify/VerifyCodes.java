package com.leadpot.phoneverify;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * 인증번호·통과 토큰 생성과 해시. 원문은 DB에 두지 않는다
 * (비밀번호 재설정 {@code auth.ResetCodes} 와 같은 원칙 — 그쪽은 패키지 전용이라 복제했다).
 */
final class VerifyCodes {

    private static final SecureRandom RANDOM = new SecureRandom();

    private VerifyCodes() {
    }

    /** 000000~999999 균등 분포 6자리. 엔트로피 부족은 시도 횟수 제한으로 메운다. */
    static String newCode() {
        return String.format("%06d", RANDOM.nextInt(1_000_000));
    }

    /** 접수 때 내는 통과 토큰(32바이트, URL-safe). 대입이 불가능한 길이라 시도 제한이 필요 없다. */
    static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** SHA-256 hex(64자). */
    static String hash(String raw) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
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
