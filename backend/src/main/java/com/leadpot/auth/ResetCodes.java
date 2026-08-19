package com.leadpot.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;

/**
 * 비밀번호 재설정 인증번호 생성/해시. 원문은 DB에 저장하지 않고 SHA-256 해시만 보관한다
 * (광고주 초대 토큰과 같은 원칙 — advertiser/InviteTokens 참고. 그쪽은 패키지 전용이라 복제했다).
 *
 * <p>6자리 숫자를 쓰는 이유: 문자로 받아 손으로 옮겨 적는 값이라 길면 UX가 나빠진다.
 * 엔트로피 부족은 시도 횟수 제한({@link PasswordResetCode#MAX_ATTEMPTS})으로 메운다.
 */
final class ResetCodes {

    private static final SecureRandom RANDOM = new SecureRandom();

    private ResetCodes() {
    }

    /** 000000~999999 균등 분포 6자리. */
    static String newCode() {
        return String.format("%06d", RANDOM.nextInt(1_000_000));
    }

    /** 조회/비교용 SHA-256 hex(64자). */
    static String hash(String code) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(code.getBytes(StandardCharsets.UTF_8));
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
