package com.leadpot.stats;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 통계 API (로그인 필요, 본인 데이터만 K5). */
@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final StatsService statsService;

    public StatsController(StatsService statsService) {
        this.statsService = statsService;
    }

    @GetMapping("/overview")
    public StatsResponse overview(@AuthenticationPrincipal Jwt jwt) {
        return statsService.overview(Long.valueOf(jwt.getSubject()));
    }
}
