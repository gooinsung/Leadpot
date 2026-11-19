package com.leadpot.adautomation;

import java.util.Arrays;
import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.adautomation.connection.AdConnection;
import com.leadpot.adautomation.connection.AdConnectionService;
import com.leadpot.adautomation.connection.CredentialCipher;
import com.leadpot.adautomation.dto.AdAutomationDtos.AccountResponse;
import com.leadpot.adautomation.dto.AdAutomationDtos.ActionResultResponse;
import com.leadpot.adautomation.dto.AdAutomationDtos.CampaignResponse;
import com.leadpot.adautomation.dto.AdAutomationDtos.CampaignStatusRequest;
import com.leadpot.adautomation.dto.AdAutomationDtos.CatalogResponse;
import com.leadpot.adautomation.dto.AdAutomationDtos.ConnectionRequest;
import com.leadpot.adautomation.dto.AdAutomationDtos.ConnectionResponse;
import com.leadpot.adautomation.dto.AdAutomationDtos.EnabledRequest;
import com.leadpot.adautomation.dto.AdAutomationDtos.LogResponse;
import com.leadpot.adautomation.dto.AdAutomationDtos.PlatformInfo;
import com.leadpot.adautomation.dto.AdAutomationDtos.RuleRequest;
import com.leadpot.adautomation.dto.AdAutomationDtos.RuleResponse;
import com.leadpot.adautomation.dto.AdAutomationDtos.TypeInfo;
import com.leadpot.adautomation.platform.AdPlatform;
import com.leadpot.adautomation.platform.AdPlatformClients;
import com.leadpot.adautomation.rule.AdRuleService;
import com.leadpot.adautomation.rule.RuleCatalog;
import com.leadpot.adautomation.run.AdActionLogRepository;
import com.leadpot.adautomation.run.AdCampaignOperator;
import com.leadpot.adautomation.run.TargetResult;
import com.leadpot.common.error.InvalidSubmissionException;

/**
 * 광고 연동(매체 연결·캠페인 수동 켜기/끄기·자동화 규칙·실행 이력). 마케터 전용
 * ({@code /api/**} = ROLE_USER — 광고주 하위계정은 접근 불가, 결정 15). 설계: docs/AD-AUTOMATION-PLAN.md
 */
@RestController
@RequestMapping("/api/ad-automation")
public class AdAutomationController {

    private final AdConnectionService connectionService;
    private final AdRuleService ruleService;
    private final AdCampaignOperator operator;
    private final AdActionLogRepository logRepository;
    private final AdPlatformClients clients;
    private final RuleCatalog catalog;
    private final CredentialCipher cipher;
    private final AdAutomationTrigger trigger;

    public AdAutomationController(AdConnectionService connectionService, AdRuleService ruleService,
            AdCampaignOperator operator, AdActionLogRepository logRepository, AdPlatformClients clients,
            RuleCatalog catalog, CredentialCipher cipher, AdAutomationTrigger trigger) {
        this.connectionService = connectionService;
        this.ruleService = ruleService;
        this.operator = operator;
        this.logRepository = logRepository;
        this.clients = clients;
        this.catalog = catalog;
        this.cipher = cipher;
        this.trigger = trigger;
    }

    /** 화면이 그릴 매체·입력 칸·조건·동작 종류. 매체/종류가 늘면 여기 결과만 늘어난다. */
    @GetMapping("/catalog")
    public CatalogResponse catalog() {
        List<PlatformInfo> platforms = Arrays.stream(AdPlatform.values())
                .map(p -> clients.supports(p)
                        ? new PlatformInfo(p.name(), p.label(), true, clients.get(p).credentialFields())
                        : new PlatformInfo(p.name(), p.label(), false, List.of()))
                .toList();
        List<TypeInfo> conditions = catalog.conditions().values().stream()
                .map(c -> new TypeInfo(c.type(), c.label())).toList();
        List<TypeInfo> actions = catalog.actions().values().stream()
                .map(a -> new TypeInfo(a.type(), a.label())).toList();
        return new CatalogResponse(trigger.isEnabled(), cipher.isConfigured(), platforms, conditions, actions);
    }

    // ---------- 연결 ----------

    @GetMapping("/connections")
    public List<ConnectionResponse> connections(@AuthenticationPrincipal Jwt jwt) {
        return connectionService.list(userId(jwt));
    }

    @PostMapping("/connections")
    public ConnectionResponse createConnection(@AuthenticationPrincipal Jwt jwt, @RequestBody ConnectionRequest req) {
        return connectionService.create(userId(jwt), req);
    }

    @PutMapping("/connections/{id}")
    public ConnectionResponse updateConnection(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestBody ConnectionRequest req) {
        return connectionService.update(userId(jwt), id, req);
    }

    @DeleteMapping("/connections/{id}")
    public ResponseEntity<Void> deleteConnection(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        connectionService.delete(userId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/connections/{id}/accounts")
    public List<AccountResponse> accounts(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return connectionService.accounts(userId(jwt), id);
    }

    @GetMapping("/connections/{id}/campaigns")
    public List<CampaignResponse> campaigns(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestParam String accountId) {
        return connectionService.campaigns(userId(jwt), id, accountId);
    }

    /** 수동 켜기/끄기(결정 9). 실패해도 400 이 아니라 결과로 돌려준다 — 이력에도 남는다. */
    @PostMapping("/connections/{id}/campaigns/{campaignId}/status")
    public ActionResultResponse setCampaignStatus(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @PathVariable String campaignId, @RequestBody CampaignStatusRequest req) {
        if (!trigger.isEnabled()) {
            throw new InvalidSubmissionException("광고 연동 기능이 운영자에 의해 잠시 꺼져 있습니다.");
        }
        Long ownerId = userId(jwt);
        AdConnection conn = connectionService.load(ownerId, id);
        TargetResult r = operator.setCampaignActive(ownerId, conn.getId(), req.accountId(), campaignId,
                req.campaignName(), req.active(), null);
        return new ActionResultResponse(r.success(), r.message());
    }

    // ---------- 규칙 ----------

    @GetMapping("/rules")
    public List<RuleResponse> rules(@AuthenticationPrincipal Jwt jwt) {
        return ruleService.list(userId(jwt));
    }

    @PostMapping("/rules")
    public RuleResponse createRule(@AuthenticationPrincipal Jwt jwt, @RequestBody RuleRequest req) {
        return ruleService.create(userId(jwt), req);
    }

    @PutMapping("/rules/{id}")
    public RuleResponse updateRule(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestBody RuleRequest req) {
        return ruleService.update(userId(jwt), id, req);
    }

    @PutMapping("/rules/{id}/enabled")
    public RuleResponse setRuleEnabled(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestBody EnabledRequest req) {
        return ruleService.setEnabled(userId(jwt), id, req.enabled());
    }

    @DeleteMapping("/rules/{id}")
    public ResponseEntity<Void> deleteRule(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        ruleService.delete(userId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    // ---------- 이력 ----------

    @GetMapping("/logs")
    public List<LogResponse> logs(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "100") int limit) {
        int size = Math.max(1, Math.min(limit, 300));
        return logRepository.findByOwnerIdOrderByIdDesc(userId(jwt), PageRequest.of(0, size)).stream()
                .map(l -> new LogResponse(l.getId(), l.getCreatedAt(), l.getTriggerType().name(), l.getRuleId(),
                        l.getRuleName(), l.getPlatform().name(), l.getPlatform().label(), l.getCampaignId(),
                        l.getCampaignName(), l.getAction(), l.isSuccess(), l.getMessage()))
                .toList();
    }

    private static Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
