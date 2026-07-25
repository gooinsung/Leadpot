package com.leadpot.ipblock;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;

/**
 * IP 매칭 유틸(K2) — 단일 IP 또는 CIDR 대역과 대상 IP를 비교한다.
 * IPv4/IPv6 모두 지원. 호스트명 DNS 조회를 막기 위해 숫자 리터럴만 허용한다.
 */
public final class IpMatcher {

    private IpMatcher() {
    }

    /** pattern(단일 IP 또는 CIDR)이 대상 ip 를 포함하면 true. 잘못된 입력은 false. */
    public static boolean matches(String pattern, String ip) {
        if (pattern == null || ip == null) {
            return false;
        }
        String p = pattern.trim();
        String target = ip.trim();
        if (p.isEmpty() || target.isEmpty() || !isLiteral(target)) {
            return false;
        }
        try {
            int slash = p.indexOf('/');
            if (slash < 0) {
                if (!isLiteral(p)) {
                    return false;
                }
                byte[] a = InetAddress.getByName(p).getAddress();
                byte[] b = InetAddress.getByName(target).getAddress();
                return Arrays.equals(a, b);
            }
            String base = p.substring(0, slash);
            if (!isLiteral(base)) {
                return false;
            }
            int prefix = Integer.parseInt(p.substring(slash + 1).trim());
            byte[] baseBytes = InetAddress.getByName(base).getAddress();
            byte[] ipBytes = InetAddress.getByName(target).getAddress();
            if (baseBytes.length != ipBytes.length) {
                return false; // IPv4 vs IPv6 불일치
            }
            int maxBits = baseBytes.length * 8;
            if (prefix < 0 || prefix > maxBits) {
                return false;
            }
            int fullBytes = prefix / 8;
            for (int i = 0; i < fullBytes; i++) {
                if (baseBytes[i] != ipBytes[i]) {
                    return false;
                }
            }
            int remBits = prefix % 8;
            if (remBits > 0) {
                int mask = (0xFF << (8 - remBits)) & 0xFF;
                return (baseBytes[fullBytes] & mask) == (ipBytes[fullBytes] & mask);
            }
            return true;
        } catch (UnknownHostException | NumberFormatException e) {
            return false;
        }
    }

    /** pattern 이 유효한 단일 IP 또는 CIDR 인지 검증(입력 저장 전 사용). */
    public static boolean isValid(String pattern) {
        if (pattern == null) {
            return false;
        }
        String p = pattern.trim();
        if (p.isEmpty()) {
            return false;
        }
        try {
            int slash = p.indexOf('/');
            if (slash < 0) {
                return isLiteral(p) && parseable(p);
            }
            String base = p.substring(0, slash);
            if (!isLiteral(base) || !parseable(base)) {
                return false;
            }
            int prefix = Integer.parseInt(p.substring(slash + 1).trim());
            int maxBits = InetAddress.getByName(base).getAddress().length * 8;
            return prefix >= 0 && prefix <= maxBits;
        } catch (UnknownHostException | NumberFormatException e) {
            return false;
        }
    }

    private static boolean parseable(String literal) {
        try {
            InetAddress.getByName(literal);
            return true;
        } catch (UnknownHostException e) {
            return false;
        }
    }

    /** 숫자 IP 리터럴(IPv4 점표기 또는 IPv6 콜론표기)만 허용 — 호스트명 DNS 조회 방지. */
    private static boolean isLiteral(String s) {
        return s.matches("[0-9.]+") || s.matches("[0-9A-Fa-f:.]+");
    }
}
