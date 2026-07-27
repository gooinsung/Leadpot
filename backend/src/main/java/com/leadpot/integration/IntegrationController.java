package com.leadpot.integration;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.integration.dto.IntegrationRequest;
import com.leadpot.integration.dto.IntegrationResponse;
import com.leadpot.integration.dto.TestResult;

/** 계정 연동 설정 API (로그인 필요, 본인 계정 설정만). */
@RestController
@RequestMapping("/api/integrations")
public class IntegrationController {

    private final IntegrationService service;

    public IntegrationController(IntegrationService service) {
        this.service = service;
    }

    @GetMapping
    public IntegrationResponse get(@AuthenticationPrincipal Jwt jwt) {
        return service.get(userId(jwt));
    }

    @PutMapping
    public IntegrationResponse update(@AuthenticationPrincipal Jwt jwt, @RequestBody IntegrationRequest request) {
        return service.update(userId(jwt), request);
    }

    @PostMapping("/test")
    public TestResult test(@AuthenticationPrincipal Jwt jwt) {
        return service.test(userId(jwt));
    }

    /** 특정 리드폼의 구글시트 설정으로 테스트 발송. */
    @PostMapping("/test-sheets")
    public TestResult testSheets(@AuthenticationPrincipal Jwt jwt, @RequestParam Long formId) {
        return service.testFormSheets(userId(jwt), formId);
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
