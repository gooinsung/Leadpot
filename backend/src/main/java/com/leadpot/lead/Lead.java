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

    /**
     * 통합 진행상태(V29) — 마케터·광고주가 함께 쓰는 단일 축. 값은 {@link LeadStatuses} 참고.
     * 변경은 {@link #changeStatus} 로만 해서 변경 시각·커스텀 참조가 함께 관리되게 한다.
     */
    @Column(nullable = false, length = 20)
    private String status = LeadStatuses.NEW;

    /** status=CUSTOM 일 때의 정의({@link CustomLeadStatus}). 그 외에는 null 로 유지한다. */
    @Column(name = "custom_status_id")
    private Long customStatusId;

    /** 마지막 상태 변경 시각(누가 바꿨든). 광고주 리포트의 접수→상태변경 평균에 쓴다. */
    @Column(name = "status_changed_at")
    private Instant statusChangedAt;

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

    /**
     * 분야(업종 구분, V35) — <b>접수 순간</b> 폼의 분야(forms.category)를 복사해 새긴다.
     * 폼에서 상속하지 않는 이유: 분야를 지정/변경하면 과거 리드까지 소급되는데, 운영 요구는
     * "지정 이후 접수분부터만 집계"다. 과거 리드는 인박스 일괄 지정으로만 바꾼다.
     */
    @Column(length = 50)
    private String category;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** 휴지통(soft delete). null 이면 정상, 값이 있으면 삭제된(휴지통) 리드. */
    @Column(name = "deleted_at")
    private Instant deletedAt;

    /** 광고주가 이 리드를 최초로 열어본 시각. 마케터 목록의 '광고주 확인' 표시 + 처리속도 리포트에 쓴다. */
    @Column(name = "advertiser_seen_at")
    private Instant advertiserSeenAt;

    /**
     * <b>마케터</b>가 이 리드를 열어본 시각. NULL 이면 '미확인'(V32).
     * 리드 상태와 무관하다 — 상태는 광고주도 바꾸는 축이라 열람 여부와 섞으면 안 된다.
     */
    @Column(name = "seen_at")
    private Instant seenAt;

    public Long getId() {
        return id;
    }

    public Instant getSeenAt() {
        return seenAt;
    }

    /** 마케터가 봤다고 표시. 이미 본 리드는 최초 시각을 유지한다(처음 본 때가 의미 있는 값이다). */
    public void markSeen(Instant at) {
        if (seenAt == null) {
            seenAt = at;
        }
    }

    /** 다시 '미확인'으로 되돌린다(나중에 처리하려고 남겨둘 때). */
    public void markUnseen() {
        seenAt = null;
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

    public Long getCustomStatusId() {
        return customStatusId;
    }

    public Instant getStatusChangedAt() {
        return statusChangedAt;
    }

    /**
     * 진행상태 변경(통합 축). CUSTOM 이 아니면 커스텀 참조를 반드시 비운다 —
     * 남겨두면 나중에 CUSTOM 으로 돌아왔을 때 엉뚱한 옛 정의가 살아난다.
     *
     * <p>권한 검증(광고주는 무효 불가 등)과 이력·과금은 호출부(LeadStatusService)의 몫이다.
     */
    public void changeStatus(String status, Long customStatusId, Instant at) {
        this.status = status;
        this.customStatusId = LeadStatuses.CUSTOM.equals(status) ? customStatusId : null;
        this.statusChangedAt = at;
    }

    /** 목록 필터·카운트 키(고정=코드, 커스텀=C{id}). {@link LeadStatuses#key} 참고. */
    public String statusKey() {
        return LeadStatuses.key(status, customStatusId);
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

    public String getCategory() {
        return category;
    }

    /** 빈 문자열은 null 로(분야 드롭다운에 빈 항목 방지). */
    public void setCategory(String category) {
        this.category = category == null || category.isBlank() ? null : category.trim();
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
