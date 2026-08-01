package com.leadpot.visit;

import com.leadpot.common.ClientIp;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

/** 공개 방문 기록(비로그인). 공개 랜딩/리드폼이 열릴 때 프론트가 1회 호출. best-effort → 항상 204. */
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

    /** 공용 헬퍼로 통일 — 위조 가능한 X-Forwarded-For 첫 값 방식은 순방문 통계를 조작할 수 있었다. */
    private String clientIp(HttpServletRequest http) {
        return ClientIp.of(http);
    }
}
