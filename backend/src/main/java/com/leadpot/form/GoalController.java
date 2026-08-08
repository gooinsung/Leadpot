package com.leadpot.form;

import java.util.List;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 목표 보고서 API(2026-08-09) — 마케터 전용(/api/** = ROLE_USER).
 * 목표의 설정 자체는 리드폼 편집(settings_config)으로 저장되고, 여기서는 조회만 한다.
 */
@RestController
public class GoalController {

    private final GoalReportService goalReportService;

    public GoalController(GoalReportService goalReportService) {
        this.goalReportService = goalReportService;
    }

    /** 목표가 켜진 내 리드폼 전부의 일간/월간 달성 보고서. */
    @GetMapping("/api/goals/report")
    public List<GoalReportService.GoalReportRow> report(@AuthenticationPrincipal Jwt jwt) {
        return goalReportService.report(Long.valueOf(jwt.getSubject()));
    }
}
