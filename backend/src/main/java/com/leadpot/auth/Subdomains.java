package com.leadpot.auth;

import java.security.SecureRandom;
import java.util.Set;

/**
 * 서브도메인 형식/예약어 검증 + 랜덤 생성.
 * 공개 라우팅 {subdomain}.도메인/{랜딩번호|슬러그} 에서 소유자를 식별하는 값.
 */
public final class Subdomains {

    /** 예약어(시스템/서비스용) — 사용자 지정 불가. */
    public static final Set<String> RESERVED = Set.of(
            "www", "api", "app", "admin", "mail", "smtp", "ftp", "root",
            "static", "assets", "cdn", "dashboard", "login", "signup", "logout",
            "public", "leadpot", "blog", "help", "support", "dev", "staging",
            "test", "status", "docs", "img", "images", "media", "files");

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

    private Subdomains() {
    }

    /** 소문자화·trim 정규화. */
    public static String normalize(String raw) {
        return raw == null ? "" : raw.trim().toLowerCase();
    }

    /** 형식 검증: 소문자·숫자·하이픈, 3~30자, 하이픈으로 시작/끝날 수 없음. */
    public static boolean isValidFormat(String s) {
        return s != null && s.matches("^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$");
    }

    public static boolean isReserved(String s) {
        return RESERVED.contains(s);
    }

    /** 랜덤 서브도메인(소문자 12자, 첫 글자는 영문 — 유효한 호스트 라벨). */
    public static String random() {
        StringBuilder sb = new StringBuilder(12);
        sb.append((char) ('a' + RANDOM.nextInt(26)));
        for (int i = 0; i < 11; i++) {
            sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
