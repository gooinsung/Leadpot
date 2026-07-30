package com.leadpot.common;

import jakarta.servlet.http.HttpServletRequest;

/**
 * 클라이언트 IP 추출. 프록시(Cloudflare/Nginx) 뒤에 있으므로 {@code X-Forwarded-For} 의 첫 값을 우선한다.
 * <p>
 * 기존 공개 컨트롤러들(리드 제출·방문·이벤트)에도 같은 로직이 인라인으로 들어 있다.
 * 새 코드는 이 헬퍼를 쓰고, 기존 코드는 건드리지 않는다(불필요한 재작성 지양).
 */
public final class ClientIp {

    private ClientIp() {
    }

    public static String of(HttpServletRequest http) {
        if (http == null) {
            return null;
        }
        String xff = http.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            String first = xff.split(",")[0].trim();
            if (!first.isEmpty()) {
                return cut(first);
            }
        }
        return cut(http.getRemoteAddr());
    }

    /** DB 컬럼(varchar(64)) 초과 방지. */
    private static String cut(String s) {
        if (s == null) {
            return null;
        }
        return s.length() > 64 ? s.substring(0, 64) : s;
    }
}
