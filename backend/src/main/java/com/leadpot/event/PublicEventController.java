package com.leadpot.event;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

/** 공개 이벤트 기록(비로그인). 공개 랜딩/리드폼에서 주요 클릭 시 프론트가 호출. best-effort → 항상 204. */
@RestController
@RequestMapping("/api/public/events")
public class PublicEventController {

    private final InteractionEventService eventService;

    public PublicEventController(InteractionEventService eventService) {
        this.eventService = eventService;
    }

    public record EventRequest(Long landingPageId, Long formId, String eventType, String target) {
    }

    @PostMapping
    public ResponseEntity<Void> record(@RequestBody(required = false) EventRequest req, HttpServletRequest http) {
        if (req != null && req.eventType() != null && (req.landingPageId() != null || req.formId() != null)) {
            try {
                eventService.record(req.landingPageId(), req.formId(), req.eventType(), req.target(), clientIp(http));
            } catch (Exception ignored) {
                // 이벤트 기록 실패는 무시(페이지 동작에 영향 없음)
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
