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
 * 광고주 선입금 원장 항목(V31). <b>잔액 = amount 합계</b> — 별도 잔액 컬럼을 두지 않아 어긋날 수 없다.
 *
 * <p>부호 규약: CHARGE(충전) +, DEBIT(유효 확정 차감) −, REFUND(AS 인정 환급) +, ADJUST(수동 조정) ±.
 * 생성은 {@link AdvertiserBillingService} 로만 한다 — 부호·근거(lead_id)를 거기서 강제한다.
 *
 * <p>grant 가 지워져도(권한 회수·광고주 삭제) 돈 기록은 남는다(grant_id 만 null).
 * 그래서 form_id·advertiser_id 를 함께 박아둔다.
 */
@Entity
@Table(name = "advertiser_ledger")
public class AdvertiserLedgerEntry {

    public static final String TYPE_CHARGE = "CHARGE";
    public static final String TYPE_DEBIT = "DEBIT";
    public static final String TYPE_REFUND = "REFUND";
    public static final String TYPE_ADJUST = "ADJUST";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "grant_id")
    private Long grantId;

    @Column(name = "form_id", nullable = false)
    private Long formId;

    @Column(name = "advertiser_id", nullable = false)
    private Long advertiserId;

    @Column(name = "entry_type", nullable = false, length = 10)
    private String entryType;

    /** 부호 있는 금액(원). */
    @Column(nullable = false)
    private int amount;

    @Column(name = "lead_id")
    private Long leadId;

    @Column(length = 200)
    private String memo;

    @Column(name = "created_by")
    private Long createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected AdvertiserLedgerEntry() {
        // JPA 전용
    }

    AdvertiserLedgerEntry(AdvertiserFormGrant grant, String entryType, int amount,
            Long leadId, String memo, Long createdBy) {
        this.grantId = grant.getId();
        this.formId = grant.getFormId();
        this.advertiserId = grant.getAdvertiserId();
        this.entryType = entryType;
        this.amount = amount;
        this.leadId = leadId;
        this.memo = memo;
        this.createdBy = createdBy;
    }

    public Long getId() {
        return id;
    }

    public Long getGrantId() {
        return grantId;
    }

    public Long getFormId() {
        return formId;
    }

    public Long getAdvertiserId() {
        return advertiserId;
    }

    public String getEntryType() {
        return entryType;
    }

    public int getAmount() {
        return amount;
    }

    public Long getLeadId() {
        return leadId;
    }

    public String getMemo() {
        return memo;
    }

    public Long getCreatedBy() {
        return createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
