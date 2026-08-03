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
 * 전역 접속 차단에 걸린 시도 로그. 규칙만 있으면 실제로 막히고 있는지 알 수 없어 확인용으로 남긴다.
 * 리드로는 절대 저장되지 않는다.
 */
@Entity
@Table(name = "site_ip_block_hits")
public class SiteIpBlockHit {

    /** 어디를 두드리다 막혔는지. */
    public enum Source {
        /** 랜딩 열람 */
        LANDING,
        /** 공개 리드폼 열람 */
        FORM,
        /** 리드 제출(외부 임베드 포함) */
        SUBMIT
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 64)
    private String ip;

    @Column(name = "matched_pattern", length = 64)
    private String matchedPattern;

    @Column(nullable = false, length = 16)
    private String source;

    @Column(name = "user_agent", length = 1024)
    private String userAgent;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected SiteIpBlockHit() {
    }

    public SiteIpBlockHit(Long userId, String ip, String matchedPattern, Source source, String userAgent) {
        this.userId = userId;
        this.ip = ip;
        this.matchedPattern = matchedPattern;
        this.source = source.name();
        this.userAgent = userAgent;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getIp() {
        return ip;
    }

    public String getMatchedPattern() {
        return matchedPattern;
    }

    public String getSource() {
        return source;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
