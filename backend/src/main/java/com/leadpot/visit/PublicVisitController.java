package com.leadpot.visit;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

/** 공개 방문 기록(비로그인). 공개 랜딩/폼이 열릴 때 프론트가 1회 호출. best-effort → 항상 204. */
@RestController
@RequestMapping("/api/public/visits")
public class PublicVisitController {

    private final VisitService visitService;

    public PublicVisitController(VisitService visitService) {
        this.visitService = visitService;
    }

    public record VisitRecordRequest(Long landingPageId, Long formId, Map<String, Object> utm) {
    }

    @PostMapping
    public ResponseEntity<Void> record(@RequestBody(required = false) VisitRecordRequest req, HttpServletRequest http) {
        if (req != null && (req.landingPageId() != null || req.formId() != null)) {
            VisitService.Visitor visitor = new VisitService.Visitor(
                    clientIp(http),
                    http.getHeader("User-Agent"),
                    http.getHeader("Referer"),
                    http.getHeader("Accept-Language"));
            try {
                visitService.record(req.landingPageId(), req.formId(), req.utm(), visitor);
            } catch (Exception ignored) {
                // 방문 기록 실패는 무시(페이지 동작에 영향 없음)
            }
        }
        return ResponseEntity.noContent().build();
    }

    private String clientIp(HttpServletRequest http) {
        String xff = http.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return http.getRemoteAddr();
    }
}
