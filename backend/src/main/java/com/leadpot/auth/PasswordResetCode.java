package com.leadpot.auth;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 마케터 비밀번호 재설정 인증번호 1건(V36). 원문은 저장하지 않고 SHA-256 해시만 둔다.
 *
 * <p>6자리 숫자는 경우의 수가 100만뿐이라 <b>시도 횟수 제한이 없으면 뚫린다</b> —
 * {@link #MAX_ATTEMPTS} 를 넘으면 이 코드는 죽고 처음(재요청)부터 다시 해야 한다.
 */
@Entity
@Table(name = "password_reset_codes")
public class PasswordResetCode {

    /** 틀린 입력 허용 횟수. 넘으면 코드가 무효가 된다. */
    public static final int MAX_ATTEMPTS = 5;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "code_hash", nullable = false, length = 64)
    private String codeHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "used_at")
    private Instant usedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected PasswordResetCode() {
    }

    public PasswordResetCode(Long userId, String codeHash, Instant expiresAt) {
        this.userId = userId;
        this.codeHash = codeHash;
        this.expiresAt = expiresAt;
    }

    /** 지금 입력을 받아줄 수 있는 상태인가(사용 전 · 만료 전 · 시도 초과 전). */
    public boolean usable(Instant now) {
        return usedAt == null && expiresAt.isAfter(now) && attempts < MAX_ATTEMPTS;
    }

    public void recordFailedAttempt() {
        this.attempts++;
    }

    public void markUsed(Instant at) {
        this.usedAt = at;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getCodeHash() {
        return codeHash;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public int getAttempts() {
        return attempts;
    }

    public Instant getUsedAt() {
        return usedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
