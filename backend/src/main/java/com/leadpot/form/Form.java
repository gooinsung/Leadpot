package com.leadpot.form;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

/**
 * 독립 리드폼(재사용). 랜딩과 별개로 만들어 여러 랜딩에서 연결해 쓴다(M1).
 * form_type 으로 유형을 확장한다(M7). 본문은 정렬된 블록 배열(blocks).
 */
@Entity
@Table(name = "forms")
public class Form {

    /** 허용하는 변수키 형식 — `f` + 1 이상의 정수. */
    private static final Pattern VAR_KEY = Pattern.compile("f[1-9][0-9]{0,8}");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(nullable = false)
    private String name;

    /**
     * 분야(업종 구분: 개인회생·장기렌트·임플란트 등, V34). 마케터가 폼별로 지정하고
     * 인박스에서 분야로 거른다. ⚠️ 손태그(leads.tags)와 별개 축 — 화면 문구도 '분야'.
     */
    @Column(length = 50)
    private String category;

    @Enumerated(EnumType.STRING)
    @Column(name = "form_type", nullable = false, length = 30)
    private FormType formType;

    /** 유입 방식(SELF|WEBHOOK, V39). WEBHOOK 이면 공개 렌더를 막고 웹훅으로만 리드를 받는다. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FormSource source = FormSource.SELF;

    /** 웹훅 URL 토큰의 SHA-256 해시(원문은 저장하지 않음, InviteTokens 와 동일 원칙). WEBHOOK 활성화 시에만 값이 있다. */
    @Column(name = "webhook_token_hash", length = 64)
    private String webhookTokenHash;

    /**
     * 웹훅 수신 설정. answerMapping/consentMapping(원본 키 → 리드폼 항목 라벨/동의 제목),
     * externalIdKey(멱등성에 쓸 원본 키), lastPayload/lastReceivedAt(매핑 화면 도우미),
     * lastError/lastErrorAt(최근 처리 실패, 마케터가 매핑을 고칠 단서).
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "webhook_config")
    private Map<String, Object> webhookConfig;

    @Column(name = "require_phone_verification", nullable = false)
    private boolean requirePhoneVerification;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "consent_config")
    private Map<String, Object> consentConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "submit_button_config")
    private Map<String, Object> submitButtonConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "success_config")
    private Map<String, Object> successConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "type_config")
    private Map<String, Object> typeConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "style_config")
    private Map<String, Object> styleConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "settings_config")
    private Map<String, Object> settingsConfig;

    /** 광고 픽셀 ID들: {google, meta, tiktok, kakao, daangn}. 공개 페이지에서 스크립트 삽입(I1). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tracking_config")
    private Map<String, Object> trackingConfig;

    @OneToMany(mappedBy = "form", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<FormBlock> blocks = new ArrayList<>();

    /**
     * 변수키 발급 카운터. 항목을 지워도 되돌리지 않는다 — 지운 키를 새 항목이 물려받으면
     * 과거 리드와 템플릿이 엉뚱한 값을 가리키게 된다.
     */
    @Column(name = "var_key_seq", nullable = false)
    private int varKeySeq;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Form() {
    }

    public Form(Long ownerId, String name, FormType formType) {
        this.ownerId = ownerId;
        this.name = name;
        this.formType = formType;
    }

    /**
     * 블록 전체를 교체한다(orphanRemoval 로 기존 블록 정리).
     * 이때 답변 블록의 변수키를 정리한다 — 넘어온 키는 유지하고 없는 항목에만 새로 발급한다(§변수키 규칙).
     *
     * ⚠️ <b>이미 저장된 리드폼에는 쓰지 않는다.</b> {@link #clearBlocks()} → flush → {@link #addBlocks}
     *    순서로 나눠 호출해야 한다(이유는 {@link #addBlocks} 주석). 여기서는 새로 만드는 리드폼과
     *    DB 를 타지 않는 단위 테스트만 쓴다.
     */
    public void replaceBlocks(List<FormBlock> newBlocks) {
        clearBlocks();
        addBlocks(newBlocks);
    }

    /** 블록 교체 1단계 — 기존 블록을 떼어낸다(orphanRemoval 이 DELETE 를 만든다). */
    public void clearBlocks() {
        this.blocks.clear();
    }

    /**
     * 블록 교체 2단계 — 새 블록을 붙이고 변수키를 확정한다.
     *
     * ⚠️ 이미 저장된 리드폼이라면 1단계와 이 호출 사이에 <b>반드시 flush</b> 해야 한다.
     *    Hibernate 는 한 트랜잭션에서 INSERT 를 orphan DELETE 보다 <b>먼저</b> 실행하므로,
     *    flush 없이 부르면 유지된 변수키(f1 …)를 가진 새 행이 아직 살아 있는 옛 행과 부딪혀
     *    부분 유니크 인덱스 {@code ux_form_blocks_form_var_key} 위반으로 저장이 실패한다.
     *    (실제로 2026-08-04 리드폼 저장 500 의 원인이었다.)
     */
    public void addBlocks(List<FormBlock> newBlocks) {
        Set<String> used = new HashSet<>();
        for (FormBlock kept : this.blocks) {
            if (kept.getVarKey() != null) {
                used.add(kept.getVarKey());
            }
        }
        for (FormBlock b : newBlocks) {
            b.setForm(this);
            b.setVarKey(b.producesAnswer() ? resolveVarKey(b.getVarKey(), used) : null);
            this.blocks.add(b);
        }
    }

    /**
     * 변수키 확정. 클라이언트가 보낸 값은 형식(`f숫자`)과 중복만 검사해 그대로 살리고,
     * 못 믿을 값이면 버리고 새로 발급한다. 살린 키가 카운터보다 크면 카운터를 끌어올려 충돌을 막는다.
     */
    private String resolveVarKey(String requested, Set<String> used) {
        if (requested != null && VAR_KEY.matcher(requested).matches() && used.add(requested)) {
            int n = Integer.parseInt(requested.substring(1));
            if (n > varKeySeq) {
                varKeySeq = n;
            }
            return requested;
        }
        String fresh;
        do {
            fresh = "f" + (++varKeySeq);
        } while (!used.add(fresh));
        return fresh;
    }

    /** 항목명이 바뀌어도 변하지 않는 변수키 목록(정렬 순서). 템플릿 편집기·발송에서 쓴다. */
    public List<FormBlock> answerBlocks() {
        return blocks.stream().filter(FormBlock::producesAnswer).toList();
    }

    /**
     * 동의 항목 목록({@code consentConfig.items}) — 형식이 어긋나면 빈 리스트.
     * 웹훅 매핑 화면·인바운드 수신(V39) 양쪽에서 쓴다(재사용).
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> consentItems() {
        if (consentConfig == null || !(consentConfig.get("items") instanceof List<?> items)) {
            return List.of();
        }
        return items.stream()
                .filter(Map.class::isInstance)
                .map(it -> (Map<String, Object>) it)
                .toList();
    }

    public Long getId() {
        return id;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public String getName() {
        return name;
    }

    public String getCategory() {
        return category;
    }

    /** 빈 문자열은 null 로 — 분야 드롭다운에 빈 항목이 생기지 않게. */
    public void setCategory(String category) {
        this.category = category == null || category.isBlank() ? null : category.trim();
    }

    public void setName(String name) {
        this.name = name;
    }

    public FormType getFormType() {
        return formType;
    }

    public void setFormType(FormType formType) {
        this.formType = formType;
    }

    public FormSource getSource() {
        return source;
    }

    public void setSource(FormSource source) {
        this.source = source == null ? FormSource.SELF : source;
    }

    public String getWebhookTokenHash() {
        return webhookTokenHash;
    }

    public void setWebhookTokenHash(String webhookTokenHash) {
        this.webhookTokenHash = webhookTokenHash;
    }

    public Map<String, Object> getWebhookConfig() {
        return webhookConfig;
    }

    public void setWebhookConfig(Map<String, Object> webhookConfig) {
        this.webhookConfig = webhookConfig;
    }

    public boolean isRequirePhoneVerification() {
        return requirePhoneVerification;
    }

    public void setRequirePhoneVerification(boolean requirePhoneVerification) {
        this.requirePhoneVerification = requirePhoneVerification;
    }

    public Map<String, Object> getConsentConfig() {
        return consentConfig;
    }

    public void setConsentConfig(Map<String, Object> consentConfig) {
        this.consentConfig = consentConfig;
    }

    public Map<String, Object> getSubmitButtonConfig() {
        return submitButtonConfig;
    }

    public void setSubmitButtonConfig(Map<String, Object> submitButtonConfig) {
        this.submitButtonConfig = submitButtonConfig;
    }

    public Map<String, Object> getSuccessConfig() {
        return successConfig;
    }

    public void setSuccessConfig(Map<String, Object> successConfig) {
        this.successConfig = successConfig;
    }

    public Map<String, Object> getTypeConfig() {
        return typeConfig;
    }

    public void setTypeConfig(Map<String, Object> typeConfig) {
        this.typeConfig = typeConfig;
    }

    public Map<String, Object> getStyleConfig() {
        return styleConfig;
    }

    public void setStyleConfig(Map<String, Object> styleConfig) {
        this.styleConfig = styleConfig;
    }

    public Map<String, Object> getSettingsConfig() {
        return settingsConfig;
    }

    public void setSettingsConfig(Map<String, Object> settingsConfig) {
        this.settingsConfig = settingsConfig;
    }

    public Map<String, Object> getTrackingConfig() {
        return trackingConfig;
    }

    public void setTrackingConfig(Map<String, Object> trackingConfig) {
        this.trackingConfig = trackingConfig;
    }

    public List<FormBlock> getBlocks() {
        return blocks;
    }

    public int getVarKeySeq() {
        return varKeySeq;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
