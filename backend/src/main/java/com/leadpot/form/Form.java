package com.leadpot.form;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

/**
 * 독립 리드폼(재사용). 랜딩과 별개로 만들어 여러 랜딩에서 연결해 쓴다(M1).
 * form_type 으로 유형을 확장한다(M7). 본문은 정렬된 블록 배열(blocks).
 */
@Entity
@Table(name = "forms")
public class Form {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "form_type", nullable = false, length = 30)
    private FormType formType;

    @Column(name = "require_phone_verification", nullable = false)
    private boolean requirePhoneVerification;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "consent_config")
    private Map<String, Object> consentConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "submit_button_config")
    private Map<String, Object> submitButtonConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "success_config")
    private Map<String, Object> successConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "type_config")
    private Map<String, Object> typeConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "style_config")
    private Map<String, Object> styleConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "settings_config")
    private Map<String, Object> settingsConfig;

    /** 광고 픽셀 ID들: {google, meta, tiktok, kakao, daangn}. 공개 페이지에서 스크립트 삽입(I1). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tracking_config")
    private Map<String, Object> trackingConfig;

    @OneToMany(mappedBy = "form", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<FormBlock> blocks = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Form() {
    }

    public Form(Long ownerId, String name, FormType formType) {
        this.ownerId = ownerId;
        this.name = name;
        this.formType = formType;
    }

    /** 편집 저장 시 블록 전체를 교체한다(orphanRemoval 로 기존 블록 정리). */
    public void replaceBlocks(List<FormBlock> newBlocks) {
        this.blocks.clear();
        for (FormBlock b : newBlocks) {
            b.setForm(this);
            this.blocks.add(b);
        }
    }

    public Long getId() {
        return id;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public FormType getFormType() {
        return formType;
    }

    public void setFormType(FormType formType) {
        this.formType = formType;
    }

    public boolean isRequirePhoneVerification() {
        return requirePhoneVerification;
    }

    public void setRequirePhoneVerification(boolean requirePhoneVerification) {
        this.requirePhoneVerification = requirePhoneVerification;
    }

    public Map<String, Object> getConsentConfig() {
        return consentConfig;
    }

    public void setConsentConfig(Map<String, Object> consentConfig) {
        this.consentConfig = consentConfig;
    }

    public Map<String, Object> getSubmitButtonConfig() {
        return submitButtonConfig;
    }

    public void setSubmitButtonConfig(Map<String, Object> submitButtonConfig) {
        this.submitButtonConfig = submitButtonConfig;
    }

    public Map<String, Object> getSuccessConfig() {
        return successConfig;
    }

    public void setSuccessConfig(Map<String, Object> successConfig) {
        this.successConfig = successConfig;
    }

    public Map<String, Object> getTypeConfig() {
        return typeConfig;
    }

    public void setTypeConfig(Map<String, Object> typeConfig) {
        this.typeConfig = typeConfig;
    }

    public Map<String, Object> getStyleConfig() {
        return styleConfig;
    }

    public void setStyleConfig(Map<String, Object> styleConfig) {
        this.styleConfig = styleConfig;
    }

    public Map<String, Object> getSettingsConfig() {
        return settingsConfig;
    }

    public void setSettingsConfig(Map<String, Object> settingsConfig) {
        this.settingsConfig = settingsConfig;
    }

    public Map<String, Object> getTrackingConfig() {
        return trackingConfig;
    }

    public void setTrackingConfig(Map<String, Object> trackingConfig) {
        this.trackingConfig = trackingConfig;
    }

    public List<FormBlock> getBlocks() {
        return blocks;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
