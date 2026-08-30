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
     * <b>이 리드폼에만</b> 적용할 수신번호(숫자만). 비어 있으면 광고주 계정 기본값
     * ({@code users.notify_phone})을 쓴다(V33).
     * <p>
     * 마케터가 대신 넣을 수 없다 — 광고주 본인이 넣는 행위가 곧 수신 동의 근거다(V28, MESSAGING-PLAN §9).
     * 채널 중립 이름이다: 지금은 알림톡, 채널이 바뀌어도 그대로 쓴다.
     */
    @Column(name = "notify_phone", length = 20)
    private String notifyPhone;

    /** 번호를 등록·변경한 시각 = 수신 동의 시점. 분쟁·재심사 때 근거로 쓴다. */
    @Column(name = "notify_phone_at")
    private Instant notifyPhoneAt;

    /**
     * true 면 <b>이 리드폼만</b> 광고주 알림을 보내지 않는다(계정 기본 번호가 있어도).
     *
     * <p>계정 기본값이 생기면서 "번호를 비우면 중단"이 성립하지 않게 됐다 — 비우면 기본값으로 나간다.
     * 그래서 '미설정(=기본값 사용)' 과 '이 폼은 끔' 을 구분하는 값이 따로 필요하다(V33).
     */
    @Column(name = "notify_disabled", nullable = false)
    private boolean notifyDisabled;

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
     * 이 리드폼 전용 수신번호를 등록·변경·삭제한다(광고주 본인만).
     * 빈 값이면 덮어쓰기를 해제해 <b>계정 기본 번호를 따라간다</b>(V33) — 발송을 멈추는 게 아니다.
     * 이 폼만 끄려면 {@link #setNotifyDisabled} 를 쓴다.
     *
     * @param phone 정규화된 번호(숫자만) 또는 null/빈 값
     */
    public void setNotifyPhone(String phone, Instant at) {
        boolean blank = phone == null || phone.isBlank();
        this.notifyPhone = blank ? null : phone;
        this.notifyPhoneAt = blank ? null : at;
    }

    /** 이 리드폼 전용 번호가 지정돼 있는지(= 계정 기본값을 덮어쓰는 중인지). */
    public boolean hasNotifyPhone() {
        return notifyPhone != null && !notifyPhone.isBlank();
    }

    public boolean isNotifyDisabled() {
        return notifyDisabled;
    }

    /** 이 리드폼만 알림을 끄거나 다시 켠다(광고주 본인만). */
    public void setNotifyDisabled(boolean disabled) {
        this.notifyDisabled = disabled;
    }

    /**
     * 이 리드폼의 실제 수신번호를 정한다: <b>폼 전용 번호 → 계정 기본 번호</b> 순.
     * 이 폼이 꺼져 있으면 번호가 있어도 보내지 않는다.
     *
     * @param accountDefault 광고주 계정 기본 번호({@code users.notify_phone})
     * @return 보낼 번호, 없거나 꺼져 있으면 null
     */
    public String resolveNotifyPhone(String accountDefault) {
        if (notifyDisabled) {
            return null;
        }
        if (hasNotifyPhone()) {
            return notifyPhone;
        }
        return (accountDefault == null || accountDefault.isBlank()) ? null : accountDefault;
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
