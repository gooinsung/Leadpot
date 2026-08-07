package com.leadpot.advertiser;

import java.util.List;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 정산 총괄 API(V31) — 마케터의 '정산' 메뉴. 리드폼 편집 카드와 같은 숫자를 전 계약 한 화면으로.
 * 마케터 전용(SecurityConfig: /api/** = ROLE_USER). 소유권은 owner 기준 조회라 별도 검증이 필요 없다.
 */
@RestController
public class BillingOverviewController {

    private final AdvertiserBillingService billingService;

    public BillingOverviewController(AdvertiserBillingService billingService) {
        this.billingService = billingService;
    }

    /** 과금 계약(grant)이 있는 내 리드폼 전부의 잔액·이번달 수익·목표 진행. */
    @GetMapping("/api/billing/overview")
    public List<AdvertiserBillingService.BillingOverviewRow> overview(@AuthenticationPrincipal Jwt jwt) {
        return billingService.overview(Long.valueOf(jwt.getSubject()));
    }
}
