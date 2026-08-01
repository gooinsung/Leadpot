package com.leadpot.ipblock;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 계정 전역 '접속 차단' 규칙. pattern 은 단일 IP 또는 CIDR 대역.
 * <p>
 * {@link IpBlock}(K2)과 목적이 다르다 — 저쪽은 <b>특정 리드폼에 제출</b>을 막고,
 * 이쪽은 이 계정의 <b>공개 화면(랜딩·리드폼)에 접속</b> 자체를 막는다.
 * 섞으면 규칙이 헷갈리므로 테이블과 화면을 분리해 둔다.
 */
@Entity
@Table(name = "site_ip_blocks")
public class SiteIpBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 64)
    private String pattern;

    @Column(length = 255)
    private String reason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected SiteIpBlock() {
    }

    public SiteIpBlock(Long userId, String pattern, String reason) {
        this.userId = userId;
        this.pattern = pattern;
        this.reason = reason;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
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
