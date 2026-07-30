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
 * 광고주 활동 감사 로그. 개인정보 취급 추적 + 분쟁 대비용 <b>append-only 이력</b>.
 * <p>
 * 광고주 계정이 삭제돼도 이 기록은 남아야 하므로 <b>FK 를 걸지 않았고</b>,
 * 계정이 사라진 뒤에도 누구였는지 알 수 있게 이메일을 스냅샷으로 함께 저장한다.
 * <p>
 * A2 에서는 {@link #ACTION_LOGIN} 만 기록한다(광고주 목록의 "마지막 로그인"에 사용).
 * 열람·내보내기·상태변경 기록은 A3·A4 에서 추가한다.
 */
@Entity
@Table(name = "advertiser_access_logs")
public class AdvertiserAccessLog {

    public static final String ACTION_LOGIN = "LOGIN";
    public static final String ACTION_VIEW_LEAD = "VIEW_LEAD";
    public static final String ACTION_EXPORT = "EXPORT";
    public static final String ACTION_STATUS = "STATUS";
    public static final String ACTION_MEMO = "MEMO";
    public static final String ACTION_IMPERSONATE = "IMPERSONATE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "advertiser_id", nullable = false)
    private Long advertiserId;

    @Column(name = "advertiser_email")
    private String advertiserEmail;

    @Column(name = "form_id")
    private Long formId;

    @Column(name = "lead_id")
    private Long leadId;

    @Column(nullable = false, length = 30)
    private String action;

    @Column(length = 300)
    private String detail;

    @Column(length = 64)
    private String ip;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected AdvertiserAccessLog() {
        // JPA 전용
    }

    public AdvertiserAccessLog(Long advertiserId, String advertiserEmail, String action, String ip) {
        this.advertiserId = advertiserId;
        this.advertiserEmail = advertiserEmail;
        this.action = action;
        this.ip = ip;
    }

    public AdvertiserAccessLog target(Long formId, Long leadId, String detail) {
        this.formId = formId;
        this.leadId = leadId;
        this.detail = detail;
        return this;
    }

    public Long getId() {
        return id;
    }

    public Long getAdvertiserId() {
        return advertiserId;
    }

    public String getAdvertiserEmail() {
        return advertiserEmail;
    }

    public Long getFormId() {
        return formId;
    }

    public Long getLeadId() {
        return leadId;
    }

    public String getAction() {
        return action;
    }

    public String getDetail() {
        return detail;
    }

    public String getIp() {
        return ip;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
