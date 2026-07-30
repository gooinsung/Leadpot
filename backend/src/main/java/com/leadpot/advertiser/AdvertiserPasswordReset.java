package com.leadpot.advertiser;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 광고주 비밀번호 재설정 링크. 마케터가 발급하고 광고주가 새 비밀번호를 직접 정한다.
 * 토큰 원문은 저장하지 않고 해시만 보관한다(초대와 동일 원칙).
 */
@Entity
@Table(name = "advertiser_password_resets")
public class AdvertiserPasswordReset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "advertiser_id", nullable = false)
    private Long advertiserId;

    /** 발급한 마케터(이력 추적용). */
    @Column(name = "issued_by")
    private Long issuedBy;

    @Column(name = "token_hash", nullable = false, length = 100)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    /** 사용(비밀번호 변경 완료) 시각. null 이면 미사용. */
    @Column(name = "used_at")
    private Instant usedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected AdvertiserPasswordReset() {
        // JPA 전용
    }

    public AdvertiserPasswordReset(Long advertiserId, Long issuedBy, String tokenHash, Instant expiresAt) {
        this.advertiserId = advertiserId;
        this.issuedBy = issuedBy;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
    }

    public boolean isUsable(Instant now) {
        return usedAt == null && expiresAt.isAfter(now);
    }

    public void markUsed(Instant at) {
        this.usedAt = at;
    }

    public Long getId() {
        return id;
    }

    public Long getAdvertiserId() {
        return advertiserId;
    }

    public Long getIssuedBy() {
        return issuedBy;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getUsedAt() {
        return usedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
