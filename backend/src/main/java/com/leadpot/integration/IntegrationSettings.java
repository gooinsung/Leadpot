package com.leadpot.integration;

import java.time.Instant;

import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 계정별 외부 연동 설정. 계정당 1행(owner_id 가 PK).
 * 텔레그램 봇(리드 알림) + 구글시트 Apps Script 웹훅(리드 자동 전송).
 * 토큰/URL 은 사용자가 직접 발급해 입력하는 개인 리소스다.
 */
@Entity
@Table(name = "integration_settings")
public class IntegrationSettings {

    @Id
    @Column(name = "owner_id")
    private Long ownerId;

    @Column(name = "telegram_enabled", nullable = false)
    private boolean telegramEnabled;

    @Column(name = "telegram_bot_token", length = 200)
    private String telegramBotToken;

    @Column(name = "telegram_chat_id", length = 100)
    private String telegramChatId;

    @Column(name = "sheets_enabled", nullable = false)
    private boolean sheetsEnabled;

    @Column(name = "sheets_webhook_url", length = 1000)
    private String sheetsWebhookUrl;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected IntegrationSettings() {
    }

    public IntegrationSettings(Long ownerId) {
        this.ownerId = ownerId;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public boolean isTelegramEnabled() {
        return telegramEnabled;
    }

    public void setTelegramEnabled(boolean telegramEnabled) {
        this.telegramEnabled = telegramEnabled;
    }

    public String getTelegramBotToken() {
        return telegramBotToken;
    }

    public void setTelegramBotToken(String telegramBotToken) {
        this.telegramBotToken = telegramBotToken;
    }

    public String getTelegramChatId() {
        return telegramChatId;
    }

    public void setTelegramChatId(String telegramChatId) {
        this.telegramChatId = telegramChatId;
    }

    public boolean isSheetsEnabled() {
        return sheetsEnabled;
    }

    public void setSheetsEnabled(boolean sheetsEnabled) {
        this.sheetsEnabled = sheetsEnabled;
    }

    public String getSheetsWebhookUrl() {
        return sheetsWebhookUrl;
    }

    public void setSheetsWebhookUrl(String sheetsWebhookUrl) {
        this.sheetsWebhookUrl = sheetsWebhookUrl;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
