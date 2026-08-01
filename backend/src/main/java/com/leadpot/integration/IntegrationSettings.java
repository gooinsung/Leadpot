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

    /** 구글시트 웹훅 보호용 공유 시크릿(선택). payload 로 함께 전송, Apps Script 가 검증. */
    @Column(name = "sheets_secret", length = 200)
    private String sheetsSecret;

    /**
     * 마케터가 자기 문자 대행사 계정을 쓰겠다고 켠 경우에만 true.
     * 기본 발송은 리드팟 시스템 키를 쓰므로 이 값이 false 여도 문자는 나간다(docs/MESSAGING-PLAN.md §11).
     */
    @Column(name = "sms_enabled", nullable = false)
    private boolean smsEnabled;

    @Column(name = "sms_api_key", length = 200)
    private String smsApiKey;

    @Column(name = "sms_api_secret", length = 200)
    private String smsApiSecret;

    /** 발송 계정에 사전등록된 발신번호. 하이픈 없이 숫자만 저장한다. */
    @Column(name = "sms_sender_phone", length = 20)
    private String smsSenderPhone;

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

    public String getSheetsSecret() {
        return sheetsSecret;
    }

    public void setSheetsSecret(String sheetsSecret) {
        this.sheetsSecret = sheetsSecret;
    }

    public boolean isSmsEnabled() {
        return smsEnabled;
    }

    public void setSmsEnabled(boolean smsEnabled) {
        this.smsEnabled = smsEnabled;
    }

    public String getSmsApiKey() {
        return smsApiKey;
    }

    public void setSmsApiKey(String smsApiKey) {
        this.smsApiKey = smsApiKey;
    }

    public String getSmsApiSecret() {
        return smsApiSecret;
    }

    public void setSmsApiSecret(String smsApiSecret) {
        this.smsApiSecret = smsApiSecret;
    }

    public String getSmsSenderPhone() {
        return smsSenderPhone;
    }

    public void setSmsSenderPhone(String smsSenderPhone) {
        this.smsSenderPhone = smsSenderPhone;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
