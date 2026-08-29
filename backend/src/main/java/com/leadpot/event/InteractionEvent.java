package com.leadpot.event;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 요소 상호작용 이벤트(I4/I5, 경량). 공개 랜딩/리드폼에서 주요 클릭(폼 열기 등)을 기록해
 * 전환 퍼널(방문→폼 열기→접수)과 요소 클릭 통계에 쓴다. IP 는 해시만 저장.
 */
@Entity
@Table(name = "interaction_events")
public class InteractionEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(name = "landing_page_id")
    private Long landingPageId;

    @Column(name = "form_id")
    private Long formId;

    @Column(name = "event_type", nullable = false, length = 40)
    private String eventType;

    @Column(length = 255)
    private String target;

    @Column(name = "ip_hash", length = 64)
    private String ipHash;

    /** 스크롤 도달 깊이(%, 0~100). eventType="scroll" 에서 임계값(25/50/75/100) 통과 시 기록. */
    @Column(name = "scroll_depth")
    private Integer scrollDepth;

    /** 체류 시간(초). eventType="page_exit"(페이지 이탈)에서 기록. */
    @Column(name = "duration_sec")
    private Integer durationSec;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Long getId() {
        return id;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(Long ownerId) {
        this.ownerId = ownerId;
    }

    public Long getLandingPageId() {
        return landingPageId;
    }

    public void setLandingPageId(Long landingPageId) {
        this.landingPageId = landingPageId;
    }

    public Long getFormId() {
        return formId;
    }

    public void setFormId(Long formId) {
        this.formId = formId;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getTarget() {
        return target;
    }

    public void setTarget(String target) {
        this.target = target;
    }

    public String getIpHash() {
        return ipHash;
    }

    public void setIpHash(String ipHash) {
        this.ipHash = ipHash;
    }

    public Integer getScrollDepth() {
        return scrollDepth;
    }

    public void setScrollDepth(Integer scrollDepth) {
        this.scrollDepth = scrollDepth;
    }

    public Integer getDurationSec() {
        return durationSec;
    }

    public void setDurationSec(Integer durationSec) {
        this.durationSec = durationSec;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
