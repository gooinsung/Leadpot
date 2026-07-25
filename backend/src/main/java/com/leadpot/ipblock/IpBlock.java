package com.leadpot.ipblock;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 리드폼별 IP 차단 규칙(K2). pattern 은 단일 IP 또는 CIDR 대역. */
@Entity
@Table(name = "ip_blocks")
public class IpBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "form_id", nullable = false)
    private Long formId;

    @Column(nullable = false, length = 64)
    private String pattern;

    @Column(length = 255)
    private String reason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected IpBlock() {
    }

    public IpBlock(Long formId, String pattern, String reason) {
        this.formId = formId;
        this.pattern = pattern;
        this.reason = reason;
    }

    public Long getId() {
        return id;
    }

    public Long getFormId() {
        return formId;
    }

    public String getPattern() {
        return pattern;
    }

    public String getReason() {
        return reason;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
