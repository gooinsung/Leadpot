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
 * 광고주 ↔ 리드폼 열람 권한. <b>광고주 권한의 단일 출처</b> — 여기 행이 없으면 광고주는 그 리드폼에 접근할 수 없다.
 * <p>
 * {@code form_id} 에 UNIQUE 제약이 걸려 있어 <b>리드폼 하나에는 광고주 한 명만</b> 붙는다(DB 수준 강제).
 */
@Entity
@Table(name = "advertiser_form_grants")
public class AdvertiserFormGrant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "advertiser_id", nullable = false)
    private Long advertiserId;

    @Column(name = "form_id", nullable = false)
    private Long formId;

    /** 광고주에게 보여줄 리드폼 이름. 비어 있으면 원래 폼 이름을 쓴다(마케터 내부 폼명 노출 주의). */
    @Column(name = "display_name", length = 120)
    private String displayName;

    /** 권한 만료 시각(계약 종료). null 이면 무기한. */
    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "can_status", nullable = false)
    private boolean canStatus = true;

    @Column(name = "can_memo", nullable = false)
    private boolean canMemo = true;

    @Column(name = "can_export", nullable = false)
    private boolean canExport = true;

    /**
     * 광고주가 <b>직접 등록한</b> 접수 알림 수신번호(숫자만). 비어 있으면 발송하지 않는다.
     * <p>
     * 마케터가 대신 넣을 수 없다 — 광고주 본인이 넣는 행위가 곧 수신 동의 근거다(V28, MESSAGING-PLAN §9).
     * 채널 중립 이름이다: 지금은 문자, 이후 알림톡으로 옮겨도 그대로 쓴다.
     */
    @Column(name = "notify_phone", length = 20)
    private String notifyPhone;

    /** 번호를 등록·변경한 시각 = 수신 동의 시점. 분쟁·재심사 때 근거로 쓴다. */
    @Column(name = "notify_phone_at")
    private Instant notifyPhoneAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected AdvertiserFormGrant() {
        // JPA 전용
    }

    public AdvertiserFormGrant(Long advertiserId, Long formId) {
        this.advertiserId = advertiserId;
        this.formId = formId;
    }

    /** 만료되지 않은 유효한 권한인지. */
    public boolean isEffective(Instant now) {
        return expiresAt == null || expiresAt.isAfter(now);
    }

    /**
     * 광고주가 자기 수신번호를 등록·변경·삭제한다. 빈 값이면 지우고 발송을 멈춘다.
     *
     * @param phone 정규화된 번호(숫자만) 또는 null/빈 값
     */
    public void setNotifyPhone(String phone, Instant at) {
        boolean blank = phone == null || phone.isBlank();
        this.notifyPhone = blank ? null : phone;
        this.notifyPhoneAt = blank ? null : at;
    }

    /** 이 리드폼으로 광고주 알림을 실제로 보낼 수 있는 상태인지(= 광고주가 번호를 등록했는지). */
    public boolean hasNotifyPhone() {
        return notifyPhone != null && !notifyPhone.isBlank();
    }

    public void apply(String displayName, Instant expiresAt, boolean canStatus, boolean canMemo, boolean canExport) {
        this.displayName = displayName;
        this.expiresAt = expiresAt;
        this.canStatus = canStatus;
        this.canMemo = canMemo;
        this.canExport = canExport;
    }

    public Long getId() {
        return id;
    }

    public Long getAdvertiserId() {
        return advertiserId;
    }

    public Long getFormId() {
        return formId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public boolean isCanStatus() {
        return canStatus;
    }

    public boolean isCanMemo() {
        return canMemo;
    }

    public boolean isCanExport() {
        return canExport;
    }

    public String getNotifyPhone() {
        return notifyPhone;
    }

    public Instant getNotifyPhoneAt() {
        return notifyPhoneAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
