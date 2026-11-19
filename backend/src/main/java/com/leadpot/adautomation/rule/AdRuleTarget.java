package com.leadpot.adautomation.rule;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 규칙이 조작할 대상(1차: 캠페인). 이름은 등록 당시 스냅샷(V49). */
@Entity
@Table(name = "ad_rule_targets")
public class AdRuleTarget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rule_id", nullable = false)
    private Long ruleId;

    @Column(name = "connection_id", nullable = false)
    private Long connectionId;

    @Column(name = "account_id", nullable = false, length = 64)
    private String accountId;

    @Column(name = "campaign_id", nullable = false, length = 64)
    private String campaignId;

    @Column(name = "campaign_name", length = 300)
    private String campaignName;

    protected AdRuleTarget() {
    }

    public AdRuleTarget(Long ruleId, Long connectionId, String accountId, String campaignId, String campaignName) {
        this.ruleId = ruleId;
        this.connectionId = connectionId;
        this.accountId = accountId;
        this.campaignId = campaignId;
        this.campaignName = campaignName;
    }

    public Long getId() {
        return id;
    }

    public Long getRuleId() {
        return ruleId;
    }

    public Long getConnectionId() {
        return connectionId;
    }

    public String getAccountId() {
        return accountId;
    }

    public String getCampaignId() {
        return campaignId;
    }

    public String getCampaignName() {
        return campaignName;
    }
}
