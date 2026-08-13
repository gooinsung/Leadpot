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

    /**
     * 광고주가 <b>직접 등록한</b> 접수 알림 수신번호(숫자만) — 배정된 <b>모든 리드폼의 기본값</b>(V33).
     *
     * <p>가입 때 받은 {@link #phone} 과 별개다. 가입 연락처는 계정 식별용이고 이건 <b>수신 동의의 근거</b>다
     * — 등록하는 행위 자체가 동의라서, 폴백으로 {@link #phone} 을 쓰면 안 된다(V28 원칙, MESSAGING-PLAN §9).
     *
     * <p>리드폼별로 다른 번호를 쓰려면 {@code advertiser_form_grants.notify_phone} 으로 덮어쓴다.
     * 마케터는 이 값을 넣을 수 없다(마스킹된 값만 조회 가능).
     */
    @Column(name = "notify_phone", length = 20)
    private String notifyPhone;

    /** 계정 기본 수신번호를 등록·변경한 시각 = 수신 동의 시점. 분쟁·재심사 때 근거로 쓴다. */
    @Column(name = "notify_phone_at")
    private Instant notifyPhoneAt;

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

    /**
     * 문자 발송 허용 여부(V25). 문자는 <b>리드팟 계정 하나로 나가고 비용을 우리가 부담</b>하므로
     * 기본은 꺼져 있고 운영자가 계정별로 열어준다(docs/MESSAGING-PLAN.md §11).
     */
    @Column(name = "sms_enabled", nullable = false)
    private boolean smsEnabled = false;

    /** 허용 채널 CSV({@code SMS,LMS,MMS}). 빈 문자열이면 아무 채널도 못 보낸다. 판정은 {@code sms.SmsPermissions}. */
    @Column(name = "sms_allowed_channels", nullable = false, length = 40)
    private String smsAllowedChannels = "";

    /**
     * 계정별 월 발송 상한. <b>⚠️ 0 = 금지, 양수 = 그 건수, -1 = 무제한.</b>
     * 예전 플랜 상수는 {@code 0} 을 무제한으로 해석했다 — 규약이 반대라 섞이면 사고가 난다(V25 주석 참고).
     */
    @Column(name = "sms_monthly_limit", nullable = false)
    private int smsMonthlyLimit = 0;

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

    public String getNotifyPhone() {
        return notifyPhone;
    }

    public Instant getNotifyPhoneAt() {
        return notifyPhoneAt;
    }

    /** 계정 기본 수신번호를 등록·변경·삭제한다(광고주 본인만). 빈 값이면 지운다 — 폴백은 없다. */
    public void setNotifyPhone(String phone, Instant at) {
        boolean blank = phone == null || phone.isBlank();
        this.notifyPhone = blank ? null : phone;
        this.notifyPhoneAt = blank ? null : at;
    }

    /** 계정 기본 수신번호가 등록돼 있는지. */
    public boolean hasNotifyPhone() {
        return notifyPhone != null && !notifyPhone.isBlank();
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public Role getRole() {
        return role;
    }

    /** 운영자 승격(부트스트랩 전용). 되돌리려면 DB 를 직접 고쳐야 한다. */
    public void setRole(Role role) {
        this.role = role;
    }

    public Plan getPlan() {
        return plan;
    }

    // ---------- 문자 발송 권한 (V25) ----------

    public boolean isSmsEnabled() {
        return smsEnabled;
    }

    public void setSmsEnabled(boolean smsEnabled) {
        this.smsEnabled = smsEnabled;
    }

    public String getSmsAllowedChannels() {
        return smsAllowedChannels;
    }

    public void setSmsAllowedChannels(String smsAllowedChannels) {
        this.smsAllowedChannels = smsAllowedChannels == null ? "" : smsAllowedChannels;
    }

    public int getSmsMonthlyLimit() {
        return smsMonthlyLimit;
    }

    public void setSmsMonthlyLimit(int smsMonthlyLimit) {
        this.smsMonthlyLimit = smsMonthlyLimit;
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
