package com.leadpot.adautomation.rule;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 자동화 규칙 = 리드폼 1개 + 조건 1개 + 동작 1개 + 대상 N개({@link AdRuleTarget}).
 * 조건·동작은 종류 문자열 + 설정 JSON 이라 새 종류를 추가해도 스키마가 바뀌지 않는다(V49).
 */
@Entity
@Table(name = "ad_rules")
public class AdRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(name = "form_id", nullable = false)
    private Long formId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false)
    private boolean enabled = true;

    /** 자동 일시정지 사유(리드폼 삭제·연결 삭제 등). null 이면 정상. */
    @Column(name = "paused_reason", length = 200)
    private String pausedReason;

    @Column(name = "condition_type", nullable = false, length = 40)
    private String conditionType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "condition_config", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> conditionConfig = new LinkedHashMap<>();

    @Column(name = "action_type", nullable = false, length = 40)
    private String actionType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "action_config", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> actionConfig = new LinkedHashMap<>();

    @Column(name = "notify_success", nullable = false)
    private boolean notifySuccess = true;

    @Column(name = "last_fired_period", length = 40)
    private String lastFiredPeriod;

    @Column(name = "last_fired_at")
    private Instant lastFiredAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected AdRule() {
    }

    public AdRule(Long ownerId) {
        this.ownerId = ownerId;
    }

    public boolean isRunnable() {
        return enabled && pausedReason == null;
    }

    public Long getId() {
        return id;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public Long getFormId() {
        return formId;
    }

    public void setFormId(Long formId) {
        this.formId = formId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getPausedReason() {
        return pausedReason;
    }

    public void setPausedReason(String pausedReason) {
        this.pausedReason = pausedReason;
    }

    public String getConditionType() {
        return conditionType;
    }

    public void setConditionType(String conditionType) {
        this.conditionType = conditionType;
    }

    public Map<String, Object> getConditionConfig() {
        return conditionConfig;
    }

    public void setConditionConfig(Map<String, Object> conditionConfig) {
        this.conditionConfig = conditionConfig;
    }

    public String getActionType() {
        return actionType;
    }

    public void setActionType(String actionType) {
        this.actionType = actionType;
    }

    public Map<String, Object> getActionConfig() {
        return actionConfig;
    }

    public void setActionConfig(Map<String, Object> actionConfig) {
        this.actionConfig = actionConfig;
    }

    public boolean isNotifySuccess() {
        return notifySuccess;
    }

    public void setNotifySuccess(boolean notifySuccess) {
        this.notifySuccess = notifySuccess;
    }

    /** 조건을 바꾸면 오늘 이미 발동했어도 새 조건으로 다시 판단하게 한다. */
    public void resetFiring() {
        this.lastFiredPeriod = null;
    }

    public String getLastFiredPeriod() {
        return lastFiredPeriod;
    }

    public Instant getLastFiredAt() {
        return lastFiredAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
