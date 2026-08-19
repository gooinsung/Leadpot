package com.leadpot.admin;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 운영자 변경 이력. <b>지우지 않는다</b>(감사 목적이라 삭제 API 를 두지 않는다).
 *
 * <p>⚠️ {@link #detail} 에 <b>개인정보를 넣지 않는다</b> — 연락처·리드 내용은 감사에 필요하지 않고,
 * 이력은 오래 남으므로 담아두면 유출 표면이 넓어진다. 계정 식별은 {@link #targetId} 로 충분하다.
 */
@Entity
@Table(name = "admin_audit_logs")
public class AdminAuditLog {

    /** 문자 발송 권한 변경. */
    public static final String ACTION_SMS_PERMISSIONS = "SMS_PERMISSIONS_UPDATE";
    /** 기동 시 환경변수로 운영자 승격. */
    public static final String ACTION_ADMIN_BOOTSTRAP = "ADMIN_BOOTSTRAP";
    /**
     * 운영자가 계정의 리드 목록을 열람(2026-08-19 정책 변경). 리드는 고객 개인정보라
     * <b>열람 자체가 기록 대상</b>이다. detail 에는 폼 id·건수만 남긴다(개인정보 금지 원칙 유지).
     */
    public static final String ACTION_LEADS_VIEW = "LEADS_VIEW";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "admin_id", nullable = false)
    private Long adminId;

    @Column(name = "target_id")
    private Long targetId;

    @Column(nullable = false, length = 60)
    private String action;

    @Column(length = 1000)
    private String detail;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected AdminAuditLog() {
    }

    public AdminAuditLog(Long adminId, Long targetId, String action, String detail) {
        this.adminId = adminId;
        this.targetId = targetId;
        this.action = action;
        this.detail = cut(detail, 1000);
    }

    private static String cut(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() > max ? s.substring(0, max) : s;
    }

    public Long getId() {
        return id;
    }

    public Long getAdminId() {
        return adminId;
    }

    public Long getTargetId() {
        return targetId;
    }

    public String getAction() {
        return action;
    }

    public String getDetail() {
        return detail;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
