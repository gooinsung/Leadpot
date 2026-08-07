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
 * 광고주가 직접 만든 리드 진행상태(상담중·부재3일차 등). V29.
 *
 * <p><b>광고주 계정 단위</b>다 — 리드폼마다 다시 만들 필요 없이, 그 광고주가 권한을 가진
 * 모든 리드폼에서 함께 쓴다. 마케터도 같은 폼에서 이 상태를 조회하고 지정할 수 있다(공유 축).
 *
 * <p><b>삭제 대신 보관(archived)</b> — 이미 리드가 이 상태를 쓰고 있을 수 있어 정의를 지우면
 * 그 리드들의 상태 이름이 사라진다. 보관하면 선택 목록에서만 빠지고 기존 리드에는 계속 표시된다.
 * (DB 의 FK 는 on delete set null 이라 행을 강제로 지워도 리드는 깨지지 않는다.)
 */
@Entity
@Table(name = "lead_statuses")
public class CustomLeadStatus {

    /** 이름 최대 길이(DB varchar 와 일치). */
    public static final int NAME_MAX = 30;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "advertiser_id", nullable = false)
    private Long advertiserId;

    @Column(nullable = false, length = NAME_MAX)
    private String name;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(nullable = false)
    private boolean archived;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected CustomLeadStatus() {
        // JPA 전용
    }

    public CustomLeadStatus(Long advertiserId, String name, int sortOrder) {
        this.advertiserId = advertiserId;
        this.name = name;
        this.sortOrder = sortOrder;
    }

    public Long getId() {
        return id;
    }

    public Long getAdvertiserId() {
        return advertiserId;
    }

    public String getName() {
        return name;
    }

    public void rename(String name) {
        this.name = name;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }

    public boolean isArchived() {
        return archived;
    }

    public void setArchived(boolean archived) {
        this.archived = archived;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
