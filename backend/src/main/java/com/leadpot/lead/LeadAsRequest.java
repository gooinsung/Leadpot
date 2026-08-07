package com.leadpot.lead;

import java.time.Instant;
import java.util.List;

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
 * AS 요청(V30) — 광고주가 리드에 제기한 이의. 리드 상태 {@code AS_REQUESTED} 와 짝으로 만들어진다.
 *
 * <p>흐름: 광고주 접수(사유 필수·증빙 이미지 선택) → 마케터 알림 → 마케터가
 * <b>인정</b>(ACCEPTED, 리드 무효 + 과금 환급) 또는 <b>거부</b>(REJECTED, 리드 유효 확정).
 *
 * <p>한 리드에 요청이 여러 번 있을 수 있다(거부 후 재요청) — OPEN 은 동시에 하나만 허용한다.
 */
@Entity
@Table(name = "lead_as_requests")
public class LeadAsRequest {

    public static final String STATUS_OPEN = "OPEN";
    public static final String STATUS_ACCEPTED = "ACCEPTED";
    public static final String STATUS_REJECTED = "REJECTED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "lead_id", nullable = false)
    private Long leadId;

    /** 요청한 광고주. 계정이 삭제되면 null (기록은 보존 — V27 원칙). */
    @Column(name = "advertiser_id")
    private Long advertiserId;

    @Column(nullable = false, columnDefinition = "text")
    private String reason;

    /** 증빙 이미지 URL 배열(v1 이미지 전용, 광고주 업로드 경로로 올린 것). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "evidence_urls")
    private List<String> evidenceUrls;

    @Column(nullable = false, length = 20)
    private String status = STATUS_OPEN;

    @Column(name = "resolved_by")
    private Long resolvedBy;

    @Column(name = "resolution_note", length = 500)
    private String resolutionNote;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    protected LeadAsRequest() {
        // JPA 전용
    }

    public LeadAsRequest(Long leadId, Long advertiserId, String reason, List<String> evidenceUrls) {
        this.leadId = leadId;
        this.advertiserId = advertiserId;
        this.reason = reason;
        this.evidenceUrls = evidenceUrls == null || evidenceUrls.isEmpty() ? null : evidenceUrls;
    }

    /** 마케터 처리(인정/거부). */
    public void resolve(boolean accepted, Long marketerId, String note, Instant at) {
        this.status = accepted ? STATUS_ACCEPTED : STATUS_REJECTED;
        this.resolvedBy = marketerId;
        this.resolutionNote = note == null || note.isBlank() ? null : note.trim();
        this.resolvedAt = at;
    }

    public boolean isOpen() {
        return STATUS_OPEN.equals(status);
    }

    public Long getId() {
        return id;
    }

    public Long getLeadId() {
        return leadId;
    }

    public Long getAdvertiserId() {
        return advertiserId;
    }

    public String getReason() {
        return reason;
    }

    public List<String> getEvidenceUrls() {
        return evidenceUrls;
    }

    public String getStatus() {
        return status;
    }

    public Long getResolvedBy() {
        return resolvedBy;
    }

    public String getResolutionNote() {
        return resolutionNote;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }
}
