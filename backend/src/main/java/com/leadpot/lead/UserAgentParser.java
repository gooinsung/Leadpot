package com.leadpot.lead;

/**
 * User-Agent 문자열에서 기기/OS/브라우저를 간단 파싱한다(MVP 휴리스틱, 외부 라이브러리 없음).
 * 정밀도가 더 필요하면 이후 전용 파서로 교체.
 */
public final class UserAgentParser {

    private UserAgentParser() {
    }

    public static String device(String ua) {
        if (ua == null) return null;
        String u = ua.toLowerCase();
        if (u.contains("ipad") || (u.contains("tablet") && !u.contains("mobile"))) return "TABLET";
        if (u.contains("mobi") || u.contains("iphone") || u.contains("android")) return "MOBILE";
        return "PC";
    }

    public static String os(String ua) {
        if (ua == null) return null;
        String u = ua.toLowerCase();
        if (u.contains("windows")) return "Windows";
        if (u.contains("iphone") || u.contains("ipad") || u.contains("ios")) return "iOS";
        if (u.contains("mac os x") || u.contains("macintosh")) return "macOS";
        if (u.contains("android")) return "Android";
        if (u.contains("linux")) return "Linux";
        return "기타";
    }

    public static String browser(String ua) {
        if (ua == null) return null;
        if (ua.contains("Edg")) return "Edge";
        if (ua.contains("SamsungBrowser")) return "Samsung Internet";
        if (ua.contains("Whale")) return "Whale";
        if (ua.contains("Firefox")) return "Firefox";
        if (ua.contains("Chrome")) return "Chrome";
        if (ua.contains("Safari")) return "Safari";
        return "기타";
    }
}
