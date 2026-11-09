package com.leadpot.phoneverify;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 리드폼 휴대폰 본인인증 1건(V48). 인증번호·토큰·번호 모두 해시만 둔다.
 *
 * <p>상태 흐름: 문자 발송 → {@link #PENDING} → 번호 일치 → {@link #VERIFIED}(토큰 발급) → 접수 시 {@code usedAt}.
 * 문자를 못 보내면 곧바로 {@link #FALLBACK}(토큰 발급) — 사용자 결정(2026-11-09)으로 미인증 접수를 허용한다.
 */
@Entity
@Table(name = "phone_verifications")
public class PhoneVerification {

    public static final String PENDING = "PENDING";
    public static final String VERIFIED = "VERIFIED";
    public static final String FALLBACK = "FALLBACK";

    /** 틀린 입력 허용 횟수. 6자리 숫자는 시도 제한이 없으면 뚫린다. */
    public static final int MAX_ATTEMPTS = 5;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "form_id", nullable = false)
    private Long formId;

    @Column(name = "phone_hash", nullable = false, length = 64)
    private String phoneHash;

    @Column(name = "code_hash", length = 64)
    private String codeHash;

    @Column(name = "code_expires_at")
    private Instant codeExpiresAt;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "sms_sent", nullable = false)
    private boolean smsSent;

    @Column(nullable = false, length = 16)
    private String status;

    @Column(name = "token_hash", length = 64)
    private String tokenHash;

    @Column(name = "token_expires_at")
    private Instant tokenExpiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "requester_ip", length = 64)
    private String requesterIp;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected PhoneVerification() {
    }

    /** 인증번호를 보낸(보내려는) 건. */
    static PhoneVerification pending(Long formId, String phoneHash, String codeHash, Instant codeExpiresAt,
            String requesterIp) {
        PhoneVerification v = new PhoneVerification();
        v.formId = formId;
        v.phoneHash = phoneHash;
        v.codeHash = codeHash;
        v.codeExpiresAt = codeExpiresAt;
        v.status = PENDING;
        v.requesterIp = requesterIp;
        return v;
    }

    /** 문자를 보내지 못한 건 — 미인증 접수용 토큰만 발급한다. */
    static PhoneVerification fallback(Long formId, String phoneHash, String requesterIp) {
        PhoneVerification v = new PhoneVerification();
        v.formId = formId;
        v.phoneHash = phoneHash;
        v.status = FALLBACK;
        v.requesterIp = requesterIp;
        return v;
    }

    /** 인증번호 입력을 받아줄 수 있는 상태인가(대기 중 · 만료 전 · 시도 초과 전). */
    boolean codeUsable(Instant now) {
        return PENDING.equals(status) && codeHash != null && codeExpiresAt != null
                && codeExpiresAt.isAfter(now) && attempts < MAX_ATTEMPTS;
    }

    /** 접수에 쓸 수 있는 토큰인가(발급됨 · 미사용 · 만료 전). */
    boolean tokenUsable(Instant now) {
        return tokenHash != null && usedAt == null && tokenExpiresAt != null && tokenExpiresAt.isAfter(now);
    }

    void recordFailedAttempt() {
        this.attempts++;
    }

    void markSmsSent() {
        this.smsSent = true;
    }

    /** 문자 발송이 실패해 대기 건을 미인증 접수용으로 돌린다. 인증번호는 버린다. */
    void downgradeToFallback() {
        this.status = FALLBACK;
        this.codeHash = null;
        this.codeExpiresAt = null;
    }

    void markVerified() {
        this.status = VERIFIED;
    }

    void issueToken(String tokenHash, Instant expiresAt) {
        this.tokenHash = tokenHash;
        this.tokenExpiresAt = expiresAt;
    }

    void markUsed(Instant at) {
        this.usedAt = at;
    }

    public boolean isVerified() {
        return VERIFIED.equals(status);
    }

    public Long getId() {
        return id;
    }

    public Long getFormId() {
        return formId;
    }

    public String getPhoneHash() {
        return phoneHash;
    }

    public String getCodeHash() {
        return codeHash;
    }

    public Instant getCodeExpiresAt() {
        return codeExpiresAt;
    }

    public int getAttempts() {
        return attempts;
    }

    public boolean isSmsSent() {
        return smsSent;
    }

    public String getStatus() {
        return status;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public Instant getTokenExpiresAt() {
        return tokenExpiresAt;
    }

    public Instant getUsedAt() {
        return usedAt;
    }

    public String getRequesterIp() {
        return requesterIp;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
