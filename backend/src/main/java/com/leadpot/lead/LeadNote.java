package com.leadpot.lead;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 리드 메모/이력. 사용자가 남긴 상담 메모(MEMO) 와 상태변경 등 자동 기록(SYSTEM) 을 함께 담는다.
 * 소유자(owner)만 조회/작성(K5) — 컨트롤러/서비스에서 리드 소유권을 확인한다.
 */
@Entity
@Table(name = "lead_notes")
public class LeadNote {

    public static final String KIND_MEMO = "MEMO";
    public static final String KIND_SYSTEM = "SYSTEM";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "lead_id", nullable = false)
    private Long leadId;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(nullable = false, length = 20)
    private String kind = KIND_MEMO;

    @Column(nullable = false, columnDefinition = "text")
    private String body = "";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected LeadNote() {
    }

    public LeadNote(Long leadId, Long ownerId, String kind, String body) {
        this.leadId = leadId;
        this.ownerId = ownerId;
        this.kind = kind == null || kind.isBlank() ? KIND_MEMO : kind;
        this.body = body == null ? "" : body;
    }

    public Long getId() {
        return id;
    }

    public Long getLeadId() {
        return leadId;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public String getKind() {
        return kind;
    }

    public String getBody() {
        return body;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
