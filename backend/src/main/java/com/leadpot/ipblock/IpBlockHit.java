package com.leadpot.ipblock;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 차단된 IP가 공개 리드폼 제출을 시도한 로그(K2, 확인용). 리드로는 저장되지 않는다. */
@Entity
@Table(name = "ip_block_hits")
public class IpBlockHit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "form_id", nullable = false)
    private Long formId;

    @Column(nullable = false, length = 64)
    private String ip;

    @Column(name = "matched_pattern", length = 64)
    private String matchedPattern;

    @Column(name = "user_agent", length = 1024)
    private String userAgent;

    @Column(length = 1024)
    private String referer;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected IpBlockHit() {
    }

    public IpBlockHit(Long formId, String ip, String matchedPattern, String userAgent, String referer) {
        this.formId = formId;
        this.ip = ip;
        this.matchedPattern = matchedPattern;
        this.userAgent = userAgent;
        this.referer = referer;
    }

    public Long getId() {
        return id;
    }

    public Long getFormId() {
        return formId;
    }

    public String getIp() {
        return ip;
    }

    public String getMatchedPattern() {
        return matchedPattern;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public String getReferer() {
        return referer;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
