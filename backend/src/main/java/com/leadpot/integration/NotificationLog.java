package com.leadpot.integration;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 새 리드 알림 발송 이력(append-only). 채널·수신자·성공여부를 남겨
 * "알림을 못 받았다" 는 클레임을 반박할 근거로 쓴다.
 * <p>
 * 리드·폼·수신자가 사라져도 이력은 남아야 하므로 <b>FK 를 걸지 않는다</b>(테이블은 V18).
 */
@Entity
@Table(name = "notification_logs")
public class NotificationLog {

    public static final String CHANNEL_TELEGRAM = "TELEGRAM";
    public static final String CHANNEL_SHEETS = "SHEETS";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "lead_id")
    private Long leadId;

    @Column(name = "form_id")
    private Long formId;

    /** 수신자 계정 id(마케터 또는 광고주). */
    @Column(name = "recipient_user_id")
    private Long recipientUserId;

    @Column(nullable = false, length = 20)
    private String channel;

    @Column(nullable = false)
    private boolean success;

    @Column(name = "error_message", length = 300)
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected NotificationLog() {
        // JPA 전용
    }

    public NotificationLog(Long leadId, Long formId, Long recipientUserId,
            String channel, boolean success, String errorMessage) {
        this.leadId = leadId;
        this.formId = formId;
        this.recipientUserId = recipientUserId;
        this.channel = channel;
        this.success = success;
        this.errorMessage = errorMessage == null ? null
                : (errorMessage.length() > 300 ? errorMessage.substring(0, 300) : errorMessage);
    }

    public Long getId() {
        return id;
    }

    public Long getLeadId() {
        return leadId;
    }

    public Long getFormId() {
        return formId;
    }

    public Long getRecipientUserId() {
        return recipientUserId;
    }

    public String getChannel() {
        return channel;
    }

    public boolean isSuccess() {
        return success;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
