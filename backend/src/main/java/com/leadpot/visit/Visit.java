package com.leadpot.visit;

import java.time.Instant;
import java.util.Map;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 방문(유입) 로그. 공개 랜딩/폼이 열릴 때 남는다. 전환율(방문→접수) 통계에 사용.
 * 개인정보 최소화: 원본 IP 대신 해시만 저장한다.
 */
@Entity
@Table(name = "visits")
public class Visit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(name = "landing_page_id")
    private Long landingPageId;

    @Column(name = "form_id")
    private Long formId;

    @Column(length = 20)
    private String device;

    @Column(length = 40)
    private String os;

    @Column(length = 40)
    private String browser;

    @Column(length = 40)
    private String language;

    @Column(length = 1024)
    private String referer;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column
    private Map<String, Object> utm;

    @Column(name = "ip_hash", length = 64)
    private String ipHash;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Long getId() {
        return id;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(Long ownerId) {
        this.ownerId = ownerId;
    }

    public Long getLandingPageId() {
        return landingPageId;
    }

    public void setLandingPageId(Long landingPageId) {
        this.landingPageId = landingPageId;
    }

    public Long getFormId() {
        return formId;
    }

    public void setFormId(Long formId) {
        this.formId = formId;
    }

    public String getDevice() {
        return device;
    }

    public void setDevice(String device) {
        this.device = device;
    }

    public String getOs() {
        return os;
    }

    public void setOs(String os) {
        this.os = os;
    }

    public String getBrowser() {
        return browser;
    }

    public void setBrowser(String browser) {
        this.browser = browser;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public String getReferer() {
        return referer;
    }

    public void setReferer(String referer) {
        this.referer = referer;
    }

    public Map<String, Object> getUtm() {
        return utm;
    }

    public void setUtm(Map<String, Object> utm) {
        this.utm = utm;
    }

    public String getIpHash() {
        return ipHash;
    }

    public void setIpHash(String ipHash) {
        this.ipHash = ipHash;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
