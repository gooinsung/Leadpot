package com.leadpot.lead;

import java.util.List;
import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.lead.dto.LeadResponse;

/** 리드 조회 API (로그인 필요, 본인 폼의 리드만 K5). */
@RestController
@RequestMapping("/api/leads")
public class LeadController {

    private final LeadService leadService;

    public LeadController(LeadService leadService) {
        this.leadService = leadService;
    }

    /** 특정 폼의 리드 목록. */
    @GetMapping
    public List<LeadResponse> list(@AuthenticationPrincipal Jwt jwt, @RequestParam Long formId) {
        return leadService.list(userId(jwt), formId);
    }

    /** 대시보드용 전체 리드 수(본인 폼 전체). */
    @GetMapping("/count")
    public Map<String, Long> count(@AuthenticationPrincipal Jwt jwt) {
        return Map.of("total", leadService.countByOwner(userId(jwt)));
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
