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

    /** 마케터만 볼 수 있는 메모(기본값). 광고주 화면에는 노출되지 않는다. */
    public static final String VISIBILITY_MARKETER_ONLY = "MARKETER_ONLY";
    /** 마케터·광고주 공유. 광고주가 작성한 메모와 광고주 상태변경 이력이 여기 해당. */
    public static final String VISIBILITY_ALL = "ALL";

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

    /**
     * 노출 범위. 기본은 {@link #VISIBILITY_MARKETER_ONLY} — 마케터 내부 메모가
     * 광고주에게 새어나가지 않게 하는 것이 기본값이어야 한다(V18 에서 기존 메모도 이 값으로 백필).
     */
    @Column(nullable = false, length = 20)
    private String visibility = VISIBILITY_MARKETER_ONLY;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected LeadNote() {
    }

    /** 마케터 메모/이력 (마케터만 열람). */
    public LeadNote(Long leadId, Long ownerId, String kind, String body) {
        this(leadId, ownerId, kind, body, VISIBILITY_MARKETER_ONLY);
    }

    public LeadNote(Long leadId, Long ownerId, String kind, String body, String visibility) {
        this.leadId = leadId;
        this.ownerId = ownerId;
        this.kind = kind == null || kind.isBlank() ? KIND_MEMO : kind;
        this.body = body == null ? "" : body;
        this.visibility = VISIBILITY_ALL.equals(visibility) ? VISIBILITY_ALL : VISIBILITY_MARKETER_ONLY;
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

    public String getVisibility() {
        return visibility;
    }

    /** 광고주에게 보여도 되는 메모인지. */
    public boolean isSharedWithAdvertiser() {
        return VISIBILITY_ALL.equals(visibility);
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
