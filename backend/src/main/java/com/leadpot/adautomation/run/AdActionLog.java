package com.leadpot.adautomation.run;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import com.leadpot.adautomation.platform.AdPlatform;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 실행 이력(규칙 발동·수동 조작). 연결·규칙을 지워도 남는다(V49, FK 없음). */
@Entity
@Table(name = "ad_action_logs")
public class AdActionLog {

    public enum Trigger {
        RULE, MANUAL
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(name = "rule_id")
    private Long ruleId;

    @Column(name = "rule_name", length = 100)
    private String ruleName;

    @Enumerated(EnumType.STRING)
    @Column(name = "trigger_type", nullable = false, length = 16)
    private Trigger triggerType;

    @Column(name = "connection_id")
    private Long connectionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AdPlatform platform;

    @Column(name = "account_id", length = 64)
    private String accountId;

    @Column(name = "campaign_id", length = 64)
    private String campaignId;

    @Column(name = "campaign_name", length = 300)
    private String campaignName;

    @Column(nullable = false, length = 40)
    private String action;

    @Column(nullable = false)
    private boolean success;

    @Column(length = 1000)
    private String message;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected AdActionLog() {
    }

    @SuppressWarnings("java:S107")
    public AdActionLog(Long ownerId, Long ruleId, String ruleName, Trigger triggerType, Long connectionId,
            AdPlatform platform, String accountId, String campaignId, String campaignName, String action,
            boolean success, String message) {
        this.ownerId = ownerId;
        this.ruleId = ruleId;
        this.ruleName = ruleName;
        this.triggerType = triggerType;
        this.connectionId = connectionId;
        this.platform = platform;
        this.accountId = accountId;
        this.campaignId = campaignId;
        this.campaignName = cut(campaignName, 300);
        this.action = action;
        this.success = success;
        this.message = cut(message, 1000);
    }

    private static String cut(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    public Long getId() {
        return id;
    }

    public Long getRuleId() {
        return ruleId;
    }

    public String getRuleName() {
        return ruleName;
    }

    public Trigger getTriggerType() {
        return triggerType;
    }

    public AdPlatform getPlatform() {
        return platform;
    }

    public String getCampaignId() {
        return campaignId;
    }

    public String getCampaignName() {
        return campaignName;
    }

    public String getAction() {
        return action;
    }

    public boolean isSuccess() {
        return success;
    }

    public String getMessage() {
        return message;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
