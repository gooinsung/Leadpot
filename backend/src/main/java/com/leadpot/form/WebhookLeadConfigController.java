package com.leadpot.form;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.form.dto.WebhookLeadConfigResponse;
import com.leadpot.form.dto.WebhookMappingRequest;
import com.leadpot.form.dto.WebhookTokenResponse;

/**
 * 리드폼의 웹훅 수신 설정 API (로그인 필요, 본인 리드폼만 K5). 마케터 셀프서비스 —
 * Zapier·Make·LeadsBridge 등 어떤 외부 도구든 이 설정만으로 붙일 수 있다(META-LEADS-PLAN.md).
 */
@RestController
@RequestMapping("/api/forms/{id}/webhook")
public class WebhookLeadConfigController {

    private final FormService formService;

    public WebhookLeadConfigController(FormService formService) {
        this.formService = formService;
    }

    @GetMapping
    public WebhookLeadConfigResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return formService.getWebhookConfig(userId(jwt), id);
    }

    /** 웹훅 수신 켜기(최초 1회) — 응답에 토큰 원문이 담긴 유일한 순간. */
    @PostMapping
    public WebhookTokenResponse enable(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return formService.enableWebhook(userId(jwt), id);
    }

    /** 토큰 재발급(노출 대응) — 기존 토큰은 즉시 무효화. */
    @PostMapping("/regenerate")
    public WebhookTokenResponse regenerate(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return formService.regenerateWebhookToken(userId(jwt), id);
    }

    /** 웹훅 수신 끄기(공개 폼으로 되돌림). 토큰·매핑은 남겨둔다. */
    @DeleteMapping
    public void disable(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        formService.disableWebhook(userId(jwt), id);
    }

    @PutMapping("/mapping")
    public WebhookLeadConfigResponse saveMapping(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestBody WebhookMappingRequest request) {
        return formService.saveWebhookMapping(userId(jwt), id, request);
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
