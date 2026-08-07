package com.leadpot.advertiser;

import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.form.FormService;

/**
 * 광고주 선입금 과금 API(V31) — 마케터 전용(SecurityConfig: /api/** = ROLE_USER).
 *
 * <p>계약(단가·목표·잔액알림)은 리드폼:광고주 = 1:1 인 grant 에 저장되므로 리드폼 기준으로 다룬다.
 * 리드폼 편집 화면의 '광고주 정산' 카드가 이 API 를 쓴다.
 */
@RestController
@RequestMapping("/api/forms/{formId}/billing")
public class BillingController {

    private final AdvertiserBillingService billingService;
    private final FormService formService;

    public BillingController(AdvertiserBillingService billingService, FormService formService) {
        this.billingService = billingService;
        this.formService = formService;
    }

    /** 과금 요약(설정 + 잔액 + 이번달 수익 + 최근 원장 50건). */
    @GetMapping
    public AdvertiserBillingService.BillingView view(@AuthenticationPrincipal Jwt jwt,
            @PathVariable Long formId) {
        formService.get(userId(jwt), formId); // 소유권 확인(아니면 404)
        return billingService.view(formId);
    }

    /**
     * 과금 설정 저장. body: {"unitPrice":50000, "dailyGoal":5, "totalGoal":50,
     * "balanceAlertEnabled":true, "balanceAlertThreshold":100000, "balanceAlertPhone":"010..."}
     */
    @PutMapping
    public AdvertiserBillingService.BillingView update(@AuthenticationPrincipal Jwt jwt,
            @PathVariable Long formId, @RequestBody Map<String, Object> body) {
        formService.get(userId(jwt), formId);
        return billingService.updateSettings(formId,
                asInt(body.get("unitPrice")), asInt(body.get("dailyGoal")), asInt(body.get("totalGoal")),
                Boolean.TRUE.equals(body.get("balanceAlertEnabled")),
                asInt(body.get("balanceAlertThreshold")),
                body.get("balanceAlertPhone") == null ? null : body.get("balanceAlertPhone").toString());
    }

    /** 충전 기록. body: {"amount":500000, "memo":"8월 선입금"} */
    @PostMapping("/charge")
    public AdvertiserBillingService.BillingView charge(@AuthenticationPrincipal Jwt jwt,
            @PathVariable Long formId, @RequestBody Map<String, Object> body) {
        formService.get(userId(jwt), formId);
        return billingService.charge(formId, asInt(body.get("amount")),
                body.get("memo") == null ? null : body.get("memo").toString(), userId(jwt));
    }

    private static int asInt(Object v) {
        if (v == null) {
            return 0;
        }
        try {
            // 화면에서 "50,000" 처럼 콤마가 섞여 와도 받아준다.
            return Integer.parseInt(v.toString().replace(",", "").trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
