package com.leadpot.common.upload;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * 공개 랜딩·리드폼 응답 속 <b>옛 이미지 주소(r2.dev)</b>를 새 이미지 도메인으로 바꿔 내려준다.
 *
 * <p>배경(2026-09-26): 업로드 이미지는 R2 에 있고, 처음엔 Cloudflare 가 버킷마다 주는
 * {@code pub-xxx.r2.dev} 주소로 공개했다. r2.dev 는 개발용이라 CDN 캐시가 없고 속도 제한이 걸려
 * 랜딩 이미지가 느리게 떴다 → 같은 버킷에 커스텀 도메인({@code img.lead-pot.com})을 연결했다.
 * 새 업로드는 {@code app.storage.r2.public-base-url} 로 새 도메인이 저장되지만, 기존 랜딩·리드폼
 * 콘텐츠(JSONB)에는 r2.dev 주소가 그대로 박혀 있다. 같은 버킷·같은 키라 앞부분만 바꾸면 된다.
 *
 * <p>DB 를 고치지 않고 <b>응답에서만</b> 바꾼다 — 설정(legacy 값 비우기)만으로 즉시 되돌릴 수 있고,
 * 이미지 블록·HTML 블록·리드폼 배경 등 어디에 박혀 있든 한 번에 처리된다.
 * ⚠️ 그래서 R2 의 r2.dev 공개 접근은 꺼도 되지만, 관리 화면(편집기 미리보기)은 여전히 옛 주소를 쓰므로
 * 끄기 전에 DB 일괄 치환을 먼저 해야 한다.
 */
@Component
public class LegacyImageUrlFilter extends OncePerRequestFilter {

    private final String legacyBase;
    private final String newBase;

    public LegacyImageUrlFilter(
            @Value("${app.storage.r2.legacy-public-base-url:}") String legacyBase,
            @Value("${app.storage.r2.public-base-url:}") String newBase) {
        this.legacyBase = trimSlash(legacyBase);
        this.newBase = trimSlash(newBase);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (legacyBase.isEmpty() || newBase.isEmpty() || legacyBase.equals(newBase)) {
            return true;
        }
        if (!"GET".equals(request.getMethod())) {
            return true;
        }
        String uri = request.getRequestURI();
        return !(uri.startsWith("/api/public/sites/") || uri.startsWith("/api/public/forms/"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        ContentCachingResponseWrapper wrapper = new ContentCachingResponseWrapper(response);
        try {
            chain.doFilter(request, wrapper);
        } finally {
            String contentType = wrapper.getContentType();
            if (contentType != null && contentType.contains("json")) {
                String body = new String(wrapper.getContentAsByteArray(), StandardCharsets.UTF_8);
                if (body.contains(legacyBase)) {
                    byte[] out = body.replace(legacyBase, newBase).getBytes(StandardCharsets.UTF_8);
                    wrapper.resetBuffer();
                    wrapper.getOutputStream().write(out);
                }
            }
            wrapper.copyBodyToResponse();
        }
    }

    private static String trimSlash(String s) {
        if (s == null) {
            return "";
        }
        String t = s.trim();
        while (t.endsWith("/")) {
            t = t.substring(0, t.length() - 1);
        }
        return t;
    }
}
