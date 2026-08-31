package com.leadpot.lead.webhook;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.common.error.InvalidSubmissionException;

/**
 * 범용 인바운드 웹훅 수신 엔드포인트(비로그인, URL 의 토큰이 곧 인증). 어떤 외부 도구든(Zapier·Make·
 * LeadsBridge 등) 이 URL 로 POST 하면 리드로 들어온다(docs/META-LEADS-PLAN.md).
 *
 * <p>업무 검증 실패(필수 항목 누락·동의 미확인 등)는 <b>200 으로 응답</b>한다 — 발신자가 재시도 폭풍을
 * 일으키지 않게 하고, 대신 마케터가 리드폼 편집 화면(웹훅 설정의 "최근 오류")에서 매핑을 고치게 한다.
 * 토큰이 틀렸으면 404, 요청이 과다하면 429 로 그대로 실패 응답한다(GlobalExceptionHandler).
 */
@RestController
@RequestMapping("/api/public/webhook-leads")
public class PublicWebhookLeadController {

    private final WebhookLeadService webhookLeadService;

    public PublicWebhookLeadController(WebhookLeadService webhookLeadService) {
        this.webhookLeadService = webhookLeadService;
    }

    @PostMapping("/{token}")
    public ResponseEntity<Map<String, Object>> receive(@PathVariable String token,
            @RequestBody(required = false) Map<String, Object> payload) {
        try {
            boolean created = webhookLeadService.receive(token, payload);
            return ResponseEntity.status(HttpStatus.OK).body(Map.of("ok", true, "created", created));
        } catch (InvalidSubmissionException e) {
            return ResponseEntity.ok(Map.of("ok", false, "error", e.getMessage()));
        }
    }
}
