package com.leadpot.report;

import java.time.ZonedDateTime;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.common.error.InvalidSubmissionException;

/**
 * 리드 리포트 문자 설정·미리보기 API(V47). 마케터 본인 계정 것만(/api/** = USER 권한).
 * 미리보기는 발송하지 않는다 — 테스트 발송도 비용이라 두지 않았다.
 */
@RestController
@RequestMapping("/api/lead-report")
public class LeadReportController {

    private final LeadReportService service;

    public LeadReportController(LeadReportService service) {
        this.service = service;
    }

    public record UpdateRequest(boolean morningEnabled, boolean dailyEnabled, String phone) {
    }

    @GetMapping
    public LeadReportService.SettingsView get(@AuthenticationPrincipal Jwt jwt) {
        return service.get(userId(jwt));
    }

    @PutMapping
    public LeadReportService.SettingsView update(@AuthenticationPrincipal Jwt jwt, @RequestBody UpdateRequest req) {
        return service.update(userId(jwt), req.morningEnabled(), req.dailyEnabled(), req.phone());
    }

    /** 가장 최근에 끝난 구간 기준으로 어떤 문자가 나가는지(0건이면 text=null). */
    @GetMapping("/preview")
    public LeadReportService.Preview preview(@AuthenticationPrincipal Jwt jwt, @RequestParam String kind) {
        LeadReportKind k;
        try {
            k = LeadReportKind.valueOf(kind.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new InvalidSubmissionException("알 수 없는 리포트 종류입니다.");
        }
        return service.preview(userId(jwt), k, ZonedDateTime.now(LeadReportKind.KST));
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
