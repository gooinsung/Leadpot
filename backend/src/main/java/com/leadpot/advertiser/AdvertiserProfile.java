package com.leadpot.advertiser;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 광고주 정보(견적서 받는 쪽). 광고주 <b>로그인 계정</b>({@code users.role=ADVERTISER})과 별개다(V45).
 * <p>
 * 계정은 이메일·비밀번호가 필수이고 요금제 광고주 수 상한에 걸린다 — 견적만 보내는 업체까지 계정으로 만들 수는 없다.
 * 포털 계정이 있으면 {@link #advertiserUserId} 로 연결한다(계정 하나에 정보 하나).
 */
@Entity
@Table(name = "advertiser_profiles")
public class AdvertiserProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(name = "company_name", nullable = false, length = 120)
    private String companyName;

    @Column(name = "ceo_name", nullable = false, length = 60)
    private String ceoName = "";

    @Column(name = "biz_no", nullable = false, length = 20)
    private String bizNo = "";

    @Column(name = "contact_name", nullable = false, length = 60)
    private String contactName = "";

    @Column(nullable = false, length = 40)
    private String phone = "";

    @Column(nullable = false, length = 255)
    private String email = "";

    @Column(nullable = false, length = 255)
    private String address = "";

    /** 마케터만 보는 메모. 견적서에는 나가지 않는다. */
    @Column(nullable = false, length = 500)
    private String memo = "";

    /** 연결된 광고주 포털 계정(없으면 null). 계정을 지우면 DB 가 null 로 되돌린다. */
    @Column(name = "advertiser_user_id")
    private Long advertiserUserId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected AdvertiserProfile() {
    }

    public AdvertiserProfile(Long ownerId, String companyName) {
        this.ownerId = ownerId;
        this.companyName = nn(companyName);
    }

    public void update(String companyName, String ceoName, String bizNo, String contactName, String phone,
            String email, String address, String memo) {
        this.companyName = nn(companyName);
        this.ceoName = nn(ceoName);
        this.bizNo = nn(bizNo);
        this.contactName = nn(contactName);
        this.phone = nn(phone);
        this.email = nn(email);
        this.address = nn(address);
        this.memo = nn(memo);
    }

    private static String nn(String s) {
        return s == null ? "" : s.trim();
    }

    public Long getId() {
        return id;
    }

    public Long getOwnerId() {
        return ownerId;
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

    public String getContactName() {
        return contactName;
    }

    public String getPhone() {
        return phone;
    }

    public String getEmail() {
        return email;
    }

    public String getAddress() {
        return address;
    }

    public String getMemo() {
        return memo;
    }

    public Long getAdvertiserUserId() {
        return advertiserUserId;
    }

    public void setAdvertiserUserId(Long advertiserUserId) {
        this.advertiserUserId = advertiserUserId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
