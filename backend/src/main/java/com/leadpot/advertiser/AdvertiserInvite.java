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
 * 광고주 초대. 마케터가 발급한 링크로 광고주가 직접 비밀번호를 정해 계정을 만든다.
 * <p>
 * ⚠️ 토큰 원문은 저장하지 않는다({@link #tokenHash} 만 보관). 발급 응답에서 한 번만 노출되고,
 * 이후에는 재발급으로만 새 링크를 만들 수 있다. DB가 유출돼도 링크로 계정을 만들 수 없게 하기 위함.
 */
@Entity
@Table(name = "advertiser_invites")
public class AdvertiserInvite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 초대한 마케터. */
    @Column(name = "marketer_id", nullable = false)
    private Long marketerId;

    @Column(nullable = false)
    private String email;

    @Column(length = 120)
    private String name;

    @Column(length = 120)
    private String company;

    @Column(name = "token_hash", nullable = false, length = 100)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    /** 수락 시각. null 이면 아직 대기 중. */
    @Column(name = "accepted_at")
    private Instant acceptedAt;

    /** 수락으로 만들어진 광고주 계정 id. 계정이 삭제되면 null 이 된다(이력은 유지). */
    @Column(name = "created_user_id")
    private Long createdUserId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected AdvertiserInvite() {
        // JPA 전용
    }

    public AdvertiserInvite(Long marketerId, String email, String name, String company,
            String tokenHash, Instant expiresAt) {
        this.marketerId = marketerId;
        this.email = email;
        this.name = name;
        this.company = company;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
    }

    /** 아직 수락되지 않았고 만료도 안 된 초대인지. */
    public boolean isUsable(Instant now) {
        return acceptedAt == null && expiresAt.isAfter(now);
    }

    /** 링크 재발급: 새 토큰 해시와 만료시각으로 교체. */
    public void reissue(String tokenHash, Instant expiresAt) {
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
    }

    public void accept(Long createdUserId, Instant at) {
        this.acceptedAt = at;
        this.createdUserId = createdUserId;
    }

    public Long getId() {
        return id;
    }

    public Long getMarketerId() {
        return marketerId;
    }

    public String getEmail() {
        return email;
    }

    public String getName() {
        return name;
    }

    public String getCompany() {
        return company;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getAcceptedAt() {
        return acceptedAt;
    }

    public Long getCreatedUserId() {
        return createdUserId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
