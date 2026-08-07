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

    // ---------- 선입금 과금(V31) ----------

    /** 유효 DB 1건당 단가(원). 0 이면 과금하지 않는다(원장 기록도 안 남긴다). */
    @Column(name = "unit_price", nullable = false)
    private int unitPrice;

    /** 일 목표 수량. 그날 접수가 이 수에 도달하면 마케터에게 문자. 0 = 목표 없음. */
    @Column(name = "daily_goal", nullable = false)
    private int dailyGoal;

    /** 총 목표 수량(계약 물량). 화면 표시용. 0 = 목표 없음. */
    @Column(name = "total_goal", nullable = false)
    private int totalGoal;

    @Column(name = "balance_alert_enabled", nullable = false)
    private boolean balanceAlertEnabled;

    /** 잔액이 이 금액(원) 미만이면 알림. */
    @Column(name = "balance_alert_threshold", nullable = false)
    private int balanceAlertThreshold;

    /**
     * 잔액 알림 수신번호 — <b>마케터가 직접 지정</b>한다. V28 원칙(광고주 번호 대리 입력 금지)의
     * 유일한 예외다(2026-08-08 사용자 확정): 접수 알림을 받는 광고주와 <b>결제하는 사람</b>이
     * 다를 수 있어서다. 비어 있으면 광고주가 등록한 {@link #notifyPhone} 으로, 그것도 없으면 안 보낸다.
     */
    @Column(name = "balance_alert_phone", length = 20)
    private String balanceAlertPhone;

    /** 마지막 잔액 알림 시각 — 임계 아래에 머무는 동안 반복 발송을 막는다. 충전으로 회복되면 비운다. */
    @Column(name = "balance_alert_sent_at")
    private Instant balanceAlertSentAt;

    /** 일 목표 알림을 보낸 날(KST) — 하루 1회만 보낸다. */
    @Column(name = "goal_alert_date")
    private java.time.LocalDate goalAlertDate;

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

    // ---------- 선입금 과금(V31) ----------

    /** 과금 설정 반영(마케터). 음수는 호출부에서 걸러 들어오지 않는다고 본다(서비스 검증). */
    public void applyBilling(int unitPrice, int dailyGoal, int totalGoal,
            boolean balanceAlertEnabled, int balanceAlertThreshold, String balanceAlertPhone) {
        this.unitPrice = unitPrice;
        this.dailyGoal = dailyGoal;
        this.totalGoal = totalGoal;
        this.balanceAlertEnabled = balanceAlertEnabled;
        this.balanceAlertThreshold = balanceAlertThreshold;
        this.balanceAlertPhone = balanceAlertPhone == null || balanceAlertPhone.isBlank() ? null : balanceAlertPhone;
    }

    public int getUnitPrice() {
        return unitPrice;
    }

    public int getDailyGoal() {
        return dailyGoal;
    }

    public int getTotalGoal() {
        return totalGoal;
    }

    public boolean isBalanceAlertEnabled() {
        return balanceAlertEnabled;
    }

    public int getBalanceAlertThreshold() {
        return balanceAlertThreshold;
    }

    public String getBalanceAlertPhone() {
        return balanceAlertPhone;
    }

    public Instant getBalanceAlertSentAt() {
        return balanceAlertSentAt;
    }

    public void setBalanceAlertSentAt(Instant at) {
        this.balanceAlertSentAt = at;
    }

    public java.time.LocalDate getGoalAlertDate() {
        return goalAlertDate;
    }

    public void setGoalAlertDate(java.time.LocalDate date) {
        this.goalAlertDate = date;
    }
}
