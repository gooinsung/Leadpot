package com.leadpot.lead;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 리드(수집 데이터). 방문자가 공개 리드폼을 제출하면 생성된다.
 * 리드폼 항목이 가변이라 제출 값은 answers(JSONB)로 저장하고, 방문자 정보도 함께 기록한다.
 */
@Entity
@Table(name = "leads")
public class Lead {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "form_id", nullable = false)
    private Long formId;

    @Column(name = "landing_page_id")
    private Long landingPageId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<Map<String, Object>> answers;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column
    private List<Map<String, Object>> consents;

    @Column(nullable = false, length = 20)
    private String status = "NEW";

    @Column(name = "phone_verified", nullable = false)
    private boolean phoneVerified;

    @Column(name = "group_tag")
    private String groupTag;

    @Column(name = "submitter_ip", length = 64)
    private String submitterIp;

    @Column(name = "user_agent", length = 1024)
    private String userAgent;

    @Column(length = 20)
    private String device;

    @Column(length = 40)
    private String os;

    @Column(length = 40)
    private String browser;

    @Column(length = 40)
    private String language;

    @Column(length = 1024)
    private String referer;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column
    private Map<String, Object> utm;

    /** 자유 태그(문자열 배열). 리드 분류용(상태와 별개). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column
    private List<String> tags;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** 휴지통(soft delete). null 이면 정상, 값이 있으면 삭제된(휴지통) 리드. */
    @Column(name = "deleted_at")
    private Instant deletedAt;

    /**
     * 광고주 관점의 처리 상태 (신규/확인/통화완료/부재/종료).
     * 마케터의 {@link #status}(신규/상담중/완료/불량)와 <b>의도적으로 분리</b>한다 —
     * 같은 컬럼을 쓰면 광고주가 마케터의 분류(불량 등)를 덮어쓴다.
     */
    @Column(name = "advertiser_status", length = 30)
    private String advertiserStatus;

    @Column(name = "advertiser_status_at")
    private Instant advertiserStatusAt;

    /** 광고주가 이 리드를 최초로 열어본 시각. 마케터 목록의 '광고주 확인' 표시 + 처리속도 리포트에 쓴다. */
    @Column(name = "advertiser_seen_at")
    private Instant advertiserSeenAt;

    public Long getId() {
        return id;
    }

    public Long getFormId() {
        return formId;
    }

    public void setFormId(Long formId) {
        this.formId = formId;
    }

    public Long getLandingPageId() {
        return landingPageId;
    }

    public void setLandingPageId(Long landingPageId) {
        this.landingPageId = landingPageId;
    }

    public List<Map<String, Object>> getAnswers() {
        return answers;
    }

    public void setAnswers(List<Map<String, Object>> answers) {
        this.answers = answers;
    }

    public List<Map<String, Object>> getConsents() {
        return consents;
    }

    public void setConsents(List<Map<String, Object>> consents) {
        this.consents = consents;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public boolean isPhoneVerified() {
        return phoneVerified;
    }

    public void setPhoneVerified(boolean phoneVerified) {
        this.phoneVerified = phoneVerified;
    }

    public String getGroupTag() {
        return groupTag;
    }

    public void setGroupTag(String groupTag) {
        this.groupTag = groupTag;
    }

    public String getSubmitterIp() {
        return submitterIp;
    }

    public void setSubmitterIp(String submitterIp) {
        this.submitterIp = submitterIp;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }

    public String getDevice() {
        return device;
    }

    public void setDevice(String device) {
        this.device = device;
    }

    public String getOs() {
        return os;
    }

    public void setOs(String os) {
        this.os = os;
    }

    public String getBrowser() {
        return browser;
    }

    public void setBrowser(String browser) {
        this.browser = browser;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public String getReferer() {
        return referer;
    }

    public void setReferer(String referer) {
        this.referer = referer;
    }

    public Map<String, Object> getUtm() {
        return utm;
    }

    public void setUtm(Map<String, Object> utm) {
        this.utm = utm;
    }

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = tags;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(Instant deletedAt) {
        this.deletedAt = deletedAt;
    }

    public String getAdvertiserStatus() {
        return advertiserStatus;
    }

    public Instant getAdvertiserStatusAt() {
        return advertiserStatusAt;
    }

    /** 광고주 상태 변경(변경 시각 함께 기록). */
    public void changeAdvertiserStatus(String status, Instant at) {
        this.advertiserStatus = status;
        this.advertiserStatusAt = at;
    }

    public Instant getAdvertiserSeenAt() {
        return advertiserSeenAt;
    }

    /** 광고주 최초 열람 기록. 이미 값이 있으면 유지한다(최초 시각이 처리속도 지표의 기준). */
    public boolean markAdvertiserSeen(Instant at) {
        if (advertiserSeenAt != null) {
            return false;
        }
        advertiserSeenAt = at;
        return true;
    }
}
