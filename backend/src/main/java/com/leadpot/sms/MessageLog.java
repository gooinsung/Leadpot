package com.leadpot.sms;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 발송 이력 1건. 월 사용량(플랜 한도)도 이 표의 그 달 SENT 건수로 집계한다 —
 * 별도 카운터를 두면 실제 발송과 어긋난다(docs/MESSAGING-PLAN.md §11).
 */
@Entity
@Table(name = "message_logs")
public class MessageLog {

    public static final String STATUS_SENT = "SENT";
    public static final String STATUS_FAILED = "FAILED";
    /** 보낼 수 없어 아예 시도하지 않은 건(수신번호 없음·한도 초과 등). 조용히 사라지면 안 되므로 남긴다. */
    public static final String STATUS_SKIPPED = "SKIPPED";

    public static final String TO_MARKETER = "MARKETER";
    public static final String TO_ADVERTISER = "ADVERTISER";
    public static final String TO_LEAD = "LEAD";
    public static final String TO_TEST = "TEST";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 발송 비용을 부담하는 주체(= 리드폼 소유 마케터). 사용량 집계 기준. */
    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(name = "form_id")
    private Long formId;

    @Column(name = "lead_id")
    private Long leadId;

    @Column(name = "rule_id")
    private Long ruleId;

    @Column(name = "template_id")
    private Long templateId;

    @Column(nullable = false, length = 20)
    private String channel;

    @Column(name = "recipient_type", nullable = false, length = 20)
    private String recipientType;

    /** 마스킹해 저장한다({@link PhoneNumbers#mask}). */
    @Column(length = 40)
    private String recipient;

    @Column(name = "rendered_body", columnDefinition = "text")
    private String renderedBody;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(length = 500)
    private String error;

    @Column(name = "provider_message_id", length = 100)
    private String providerMessageId;

    /** 리드팟 키로 보냈는지(= 우리 비용, 플랜 한도 대상). */
    @Column(name = "system_credential", nullable = false)
    private boolean systemCredential = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected MessageLog() {
    }

    public MessageLog(Long ownerId, String recipientType, String channel, String status) {
        this.ownerId = ownerId;
        this.recipientType = recipientType;
        this.channel = channel;
        this.status = status;
    }

    public Long getId() {
        return id;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public Long getFormId() {
        return formId;
    }

    public void setFormId(Long formId) {
        this.formId = formId;
    }

    public Long getLeadId() {
        return leadId;
    }

    public void setLeadId(Long leadId) {
        this.leadId = leadId;
    }

    public Long getRuleId() {
        return ruleId;
    }

    public void setRuleId(Long ruleId) {
        this.ruleId = ruleId;
    }

    public Long getTemplateId() {
        return templateId;
    }

    public void setTemplateId(Long templateId) {
        this.templateId = templateId;
    }

    public String getChannel() {
        return channel;
    }

    public String getRecipientType() {
        return recipientType;
    }

    public String getRecipient() {
        return recipient;
    }

    public void setRecipient(String recipient) {
        this.recipient = recipient;
    }

    public String getRenderedBody() {
        return renderedBody;
    }

    public void setRenderedBody(String renderedBody) {
        this.renderedBody = renderedBody;
    }

    public String getStatus() {
        return status;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public String getProviderMessageId() {
        return providerMessageId;
    }

    public void setProviderMessageId(String providerMessageId) {
        this.providerMessageId = providerMessageId;
    }

    public boolean isSystemCredential() {
        return systemCredential;
    }

    public void setSystemCredential(boolean systemCredential) {
        this.systemCredential = systemCredential;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
