package com.leadpot.adautomation.connection;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import com.leadpot.adautomation.platform.AdPlatform;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 매체 연결(인증 단위, 마케터 소유). 자격증명은 암호문만 둔다(V49). */
@Entity
@Table(name = "ad_connections")
public class AdConnection {

    public enum Status {
        ACTIVE, INVALID
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AdPlatform platform;

    @Column(nullable = false, length = 100)
    private String label;

    @Column(name = "credentials_enc", nullable = false, columnDefinition = "text")
    private String credentialsEnc;

    @Column(name = "credentials_hint", length = 40)
    private String credentialsHint;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status = Status.ACTIVE;

    @Column(name = "status_message", length = 500)
    private String statusMessage;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected AdConnection() {
    }

    public AdConnection(Long ownerId, AdPlatform platform, String label, String credentialsEnc, String credentialsHint) {
        this.ownerId = ownerId;
        this.platform = platform;
        this.label = label;
        this.credentialsEnc = credentialsEnc;
        this.credentialsHint = credentialsHint;
    }

    public void replaceCredentials(String credentialsEnc, String credentialsHint) {
        this.credentialsEnc = credentialsEnc;
        this.credentialsHint = credentialsHint;
        markActive();
    }

    public void markActive() {
        this.status = Status.ACTIVE;
        this.statusMessage = null;
    }

    public void markInvalid(String message) {
        this.status = Status.INVALID;
        this.statusMessage = message == null ? null : message.length() > 500 ? message.substring(0, 500) : message;
    }

    public Long getId() {
        return id;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public AdPlatform getPlatform() {
        return platform;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public String getCredentialsEnc() {
        return credentialsEnc;
    }

    public String getCredentialsHint() {
        return credentialsHint;
    }

    public Status getStatus() {
        return status;
    }

    public String getStatusMessage() {
        return statusMessage;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
