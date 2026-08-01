package com.leadpot.common;

import jakarta.servlet.http.HttpServletRequest;

/**
 * 클라이언트 IP 추출.
 *
 * <p>⚠️ 예전에는 {@code X-Forwarded-For} 의 <b>첫 값</b>을 그대로 썼는데, 그 값은
 * <b>방문자가 마음대로 넣을 수 있다</b>. Cloudflare 는 들어온 XFF 를 지우지 않고 뒤에 덧붙이므로
 * 방문자가 {@code X-Forwarded-For: 1.2.3.4} 를 보내면 서버는 그를 1.2.3.4 로 인식했다.
 * 실측으로 확인된 문제였고, IP 차단·중복 제출 방지·순방문 통계가 모두 조작 가능했다.
 *
 * <p>그래서 <b>{@code CF-Connecting-IP} 를 최우선</b>으로 쓴다. 이 헤더는 Cloudflare 가 항상
 * 덮어쓰며(방문자가 보낸 같은 이름의 헤더는 버려진다) 우리 트래픽은 전부 Cloudflare 를 거친다.
 *
 * <p><b>남은 위험</b>: 누군가 Cloudflare 를 우회해 오리진 IP 로 직접 붙으면 이 헤더가 없어
 * XFF 로 되돌아간다. 근본 차단은 오리진 방화벽을 Cloudflare 대역으로 제한하는 인프라 작업이다
 * (docs/PROGRESS.md 오픈 전 항목 참고).
 */
public final class ClientIp {

    private ClientIp() {
    }

    public static String of(HttpServletRequest http) {
        if (http == null) {
            return null;
        }
        // 1) Cloudflare 가 넣어주는 진짜 방문자 IP(위조 불가).
        String cf = http.getHeader("CF-Connecting-IP");
        if (cf != null && !cf.isBlank()) {
            return cut(cf.trim());
        }
        // 2) Cloudflare 를 거치지 않은 경우(로컬 개발·직접 접속) — 위조 가능하므로 차선책이다.
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
