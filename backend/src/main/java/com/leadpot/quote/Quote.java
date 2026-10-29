package com.leadpot.quote;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 견적서(V45). 공급자·받는 쪽 정보는 <b>복사본</b>을 들고 있다({@link #supplier}·{@link #recipient}) —
 * 수동 입력 견적서도 그대로 남고, 사업장·광고주 정보를 나중에 고쳐도 이미 만든 견적서는 바뀌지 않는다.
 * 합계(공급가·부가세·총액)는 저장할 때 서버가 다시 계산한다({@link QuoteCalculator}).
 */
@Entity
@Table(name = "quotes")
public class Quote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    /** 연결된 광고주 정보. 수동 입력 견적서는 null. */
    @Column(name = "advertiser_profile_id")
    private Long advertiserProfileId;

    @Column(name = "quote_no", nullable = false, length = 30)
    private String quoteNo;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "issue_date", nullable = false)
    private LocalDate issueDate;

    @Column(name = "valid_until")
    private LocalDate validUntil;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private QuoteStatus status = QuoteStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(name = "vat_mode", nullable = false, length = 20)
    private VatMode vatMode = VatMode.EXCLUDED;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Map<String, Object> supplier;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Map<String, Object> recipient;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<Map<String, Object>> items;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<String> notes;

    @Column(name = "supply_total", nullable = false)
    private long supplyTotal;

    @Column(name = "vat_total", nullable = false)
    private long vatTotal;

    @Column(name = "grand_total", nullable = false)
    private long grandTotal;

    @Column(name = "issued_at")
    private Instant issuedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Quote() {
    }

    public Quote(Long ownerId, String quoteNo) {
        this.ownerId = ownerId;
        this.quoteNo = quoteNo;
    }

    public Long getId() {
        return id;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public Long getAdvertiserProfileId() {
        return advertiserProfileId;
    }

    public void setAdvertiserProfileId(Long advertiserProfileId) {
        this.advertiserProfileId = advertiserProfileId;
    }

    public String getQuoteNo() {
        return quoteNo;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public LocalDate getIssueDate() {
        return issueDate;
    }

    public void setIssueDate(LocalDate issueDate) {
        this.issueDate = issueDate;
    }

    public LocalDate getValidUntil() {
        return validUntil;
    }

    public void setValidUntil(LocalDate validUntil) {
        this.validUntil = validUntil;
    }

    public QuoteStatus getStatus() {
        return status;
    }

    public void setStatus(QuoteStatus status) {
        this.status = status;
    }

    public VatMode getVatMode() {
        return vatMode;
    }

    public void setVatMode(VatMode vatMode) {
        this.vatMode = vatMode;
    }

    public Map<String, Object> getSupplier() {
        return supplier;
    }

    public void setSupplier(Map<String, Object> supplier) {
        this.supplier = supplier;
    }

    public Map<String, Object> getRecipient() {
        return recipient;
    }

    public void setRecipient(Map<String, Object> recipient) {
        this.recipient = recipient;
    }

    public List<Map<String, Object>> getItems() {
        return items;
    }

    public void setItems(List<Map<String, Object>> items) {
        this.items = items;
    }

    public List<String> getNotes() {
        return notes;
    }

    public void setNotes(List<String> notes) {
        this.notes = notes;
    }

    public long getSupplyTotal() {
        return supplyTotal;
    }

    public long getVatTotal() {
        return vatTotal;
    }

    public long getGrandTotal() {
        return grandTotal;
    }

    public void setTotals(long supplyTotal, long vatTotal, long grandTotal) {
        this.supplyTotal = supplyTotal;
        this.vatTotal = vatTotal;
        this.grandTotal = grandTotal;
    }

    public Instant getIssuedAt() {
        return issuedAt;
    }

    public void setIssuedAt(Instant issuedAt) {
        this.issuedAt = issuedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
