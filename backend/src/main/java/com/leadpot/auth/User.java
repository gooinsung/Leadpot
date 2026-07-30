package com.leadpot.auth;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 계정(User). 리드폼·랜딩·리드를 소유하는 로그인 주체.
 * 한 계정으로 여러 랜딩/리드폼을 운영한다(A2 다계정·멀티 랜딩). 리소스 접근은 소유자 기준으로 제한(K5).
 * <p>
 * 광고주 하위계정도 같은 테이블을 쓴다({@code role=ADVERTISER}). 인증·비밀번호·토큰 로직을 공유하고,
 * 소유 마케터는 {@link #parentUserId}로 가리킨다. 광고주가 볼 수 있는 리드폼은
 * {@code advertiser_form_grants} 가 결정한다(이 엔티티에는 담지 않는다).
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    /**
     * 공개 라우팅용 서브도메인({subdomain}.도메인/{랜딩}). 마케터는 가입 시 랜덤 부여, 이후 변경 가능(unique).
     * 광고주 하위계정은 공개 페이지가 없어 null 이다.
     */
    @Column(unique = true, length = 30)
    private String subdomain;

    @Column(nullable = false)
    private String name;

    @Column
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role = Role.USER;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Plan plan = Plan.FREE;

    /** 소유 마케터 id. 광고주 하위계정만 채운다(마케터·관리자는 null). */
    @Column(name = "parent_user_id")
    private Long parentUserId;

    /** 광고주 회사명(목록 표시용). */
    @Column(length = 120)
    private String company;

    /** 마케터만 보는 내부 메모(광고주에게 노출하지 않는다). */
    @Column(length = 500)
    private String memo;

    /** 계정 활성 여부. false 면 로그인·토큰 재발급 모두 차단된다(광고주 정지/계약 해지). */
    @Column(nullable = false)
    private boolean active = true;

    /** 화이트라벨: 마케터 계정에 저장하고 소속 광고주 화면에 적용한다. */
    @Column(name = "brand_logo_url", length = 500)
    private String brandLogoUrl;

    @Column(name = "brand_color", length = 20)
    private String brandColor;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected User() {
        // JPA 전용 기본 생성자
    }

    public User(String email, String passwordHash, String name, String phone) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.name = name;
        this.phone = phone;
        this.role = Role.USER;
        this.plan = Plan.FREE;
        this.active = true;
    }

    /**
     * 광고주 하위계정 생성. 서브도메인은 부여하지 않고(공개 페이지 없음) 소유 마케터를 지정한다.
     * 초대 수락 시에만 호출한다(자가 가입 경로 없음).
     */
    public static User advertiser(String email, String passwordHash, String name, String phone,
            Long parentUserId, String company) {
        User user = new User();
        user.email = email;
        user.passwordHash = passwordHash;
        user.name = name;
        user.phone = phone;
        user.role = Role.ADVERTISER;
        user.plan = Plan.FREE;
        user.active = true;
        user.parentUserId = parentUserId;
        user.company = company;
        return user;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getSubdomain() {
        return subdomain;
    }

    public void setSubdomain(String subdomain) {
        this.subdomain = subdomain;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public Role getRole() {
        return role;
    }

    public Plan getPlan() {
        return plan;
    }

    public Long getParentUserId() {
        return parentUserId;
    }

    public String getCompany() {
        return company;
    }

    public void setCompany(String company) {
        this.company = company;
    }

    public String getMemo() {
        return memo;
    }

    public void setMemo(String memo) {
        this.memo = memo;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public String getBrandLogoUrl() {
        return brandLogoUrl;
    }

    public void setBrandLogoUrl(String brandLogoUrl) {
        this.brandLogoUrl = brandLogoUrl;
    }

    public String getBrandColor() {
        return brandColor;
    }

    public void setBrandColor(String brandColor) {
        this.brandColor = brandColor;
    }

    /** 광고주 하위계정인지. */
    public boolean isAdvertiser() {
        return role == Role.ADVERTISER;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
