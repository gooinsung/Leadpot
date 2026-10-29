package com.leadpot.account;

import java.time.Instant;

import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 마케터 본인의 사업장 정보(마이페이지 '내 정보'). 계정당 하나, 키는 계정 id 그대로.
 * 견적서를 만들 때 공급자 칸에 자동으로 복사된다 — 발행된 견적서는 복사본을 쓰므로 여기를 고쳐도 바뀌지 않는다.
 */
@Entity
@Table(name = "business_profiles")
public class BusinessProfile {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "company_name", nullable = false, length = 120)
    private String companyName = "";

    @Column(name = "ceo_name", nullable = false, length = 60)
    private String ceoName = "";

    @Column(name = "biz_no", nullable = false, length = 20)
    private String bizNo = "";

    @Column(nullable = false, length = 255)
    private String address = "";

    @Column(nullable = false, length = 40)
    private String phone = "";

    @Column(nullable = false, length = 255)
    private String email = "";

    /** 입금 계좌(예: "국민은행 123-45-6789 홍길동"). 견적서 하단에 표시. */
    @Column(name = "bank_account", nullable = false, length = 255)
    private String bankAccount = "";

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected BusinessProfile() {
    }

    public BusinessProfile(Long userId) {
        this.userId = userId;
    }

    public Long getUserId() {
        return userId;
    }

    public String getCompanyName() {
        return companyName;
    }

    public String getCeoName() {
        return ceoName;
    }

    public String getBizNo() {
        return bizNo;
    }

    public String getAddress() {
        return address;
    }

    public String getPhone() {
        return phone;
    }

    public String getEmail() {
        return email;
    }

    public String getBankAccount() {
        return bankAccount;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void update(String companyName, String ceoName, String bizNo, String address, String phone,
            String email, String bankAccount) {
        this.companyName = nn(companyName);
        this.ceoName = nn(ceoName);
        this.bizNo = nn(bizNo);
        this.address = nn(address);
        this.phone = nn(phone);
        this.email = nn(email);
        this.bankAccount = nn(bankAccount);
    }

    private static String nn(String s) {
        return s == null ? "" : s.trim();
    }
}
