package com.leadpot.adautomation.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.leadpot.adautomation.platform.AdPlatformClient.CredentialField;

/** 광고 연동 API 요청·응답(엔티티를 그대로 노출하지 않는다). 자격증명 원문은 응답에 절대 넣지 않는다. */
public final class AdAutomationDtos {

    private AdAutomationDtos() {
    }

    // ---------- 카탈로그 ----------

    public record PlatformInfo(String platform, String label, boolean supported, List<CredentialField> fields) {
    }

    public record TypeInfo(String type, String label) {
    }

    public record CatalogResponse(boolean enabled, boolean encryptionReady, List<PlatformInfo> platforms,
            List<TypeInfo> conditions, List<TypeInfo> actions) {
    }

    // ---------- 연결 ----------

    public record ConnectionRequest(String platform, String label, Map<String, String> credentials) {
    }

    public record ConnectionResponse(Long id, String platform, String platformLabel, String label,
            String credentialsHint, String status, String statusMessage, Instant createdAt) {
    }

    public record AccountResponse(String id, String name) {
    }

    public record CampaignResponse(String id, String name, boolean active, String statusLabel, boolean readOnly) {
    }

    public record CampaignStatusRequest(String accountId, String campaignName, boolean active) {
    }

    public record ActionResultResponse(boolean success, String message) {
    }

    // ---------- 규칙 ----------

    public record RuleTargetDto(Long connectionId, String connectionLabel, String platform, String accountId,
            String campaignId, String campaignName) {
    }

    public record RuleRequest(String name, Long formId, Boolean enabled, String conditionType,
            Map<String, Object> conditionConfig, String actionType, Map<String, Object> actionConfig,
            Boolean notifySuccess, List<RuleTargetDto> targets) {
    }

    public record RuleResponse(Long id, String name, Long formId, String formName, boolean enabled,
            String pausedReason, String conditionType, Map<String, Object> conditionConfig, String conditionText,
            String actionType, String actionLabel, boolean notifySuccess, String lastFiredPeriod,
            Instant lastFiredAt, List<RuleTargetDto> targets) {
    }

    public record EnabledRequest(boolean enabled) {
    }

    // ---------- 이력 ----------

    public record LogResponse(Long id, Instant createdAt, String trigger, Long ruleId, String ruleName,
            String platform, String platformLabel, String campaignId, String campaignName, String action,
            boolean success, String message) {
    }
}
