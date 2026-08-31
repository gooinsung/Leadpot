package com.leadpot.form;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.form.dto.FormBlockDto;
import com.leadpot.form.dto.FormRequest;
import com.leadpot.form.dto.FormResponse;
import com.leadpot.form.dto.FormSummary;
import com.leadpot.form.dto.WebhookLeadConfigResponse;
import com.leadpot.form.dto.WebhookMappingRequest;
import com.leadpot.form.dto.WebhookTokenResponse;
import com.leadpot.ipblock.SiteIpBlockHit;
import com.leadpot.ipblock.SiteIpBlockService;
import com.leadpot.sms.SmsPermissions;

/** 리드폼 CRUD. 모든 조회/수정은 소유자(ownerId) 기준으로 제한한다(K5). */
@Service
public class FormService {

    private final FormRepository formRepository;
    private final SiteIpBlockService siteIpBlockService;
    private final UserRepository userRepository;
    private final com.leadpot.lead.LeadRepository leadRepository;
    private final com.leadpot.ipblock.IpBlockRepository ipBlockRepository;
    private final com.leadpot.ipblock.IpBlockHitRepository ipBlockHitRepository;

    public FormService(FormRepository formRepository, SiteIpBlockService siteIpBlockService,
            UserRepository userRepository, com.leadpot.lead.LeadRepository leadRepository,
            com.leadpot.ipblock.IpBlockRepository ipBlockRepository,
            com.leadpot.ipblock.IpBlockHitRepository ipBlockHitRepository) {
        this.formRepository = formRepository;
        this.siteIpBlockService = siteIpBlockService;
        this.userRepository = userRepository;
        this.leadRepository = leadRepository;
        this.ipBlockRepository = ipBlockRepository;
        this.ipBlockHitRepository = ipBlockHitRepository;
    }

    @Transactional(readOnly = true)
    public List<FormSummary> list(Long ownerId) {
        return formRepository.findByOwnerIdOrderByUpdatedAtDesc(ownerId)
                .stream().map(FormSummary::from).toList();
    }

    @Transactional(readOnly = true)
    public FormResponse get(Long ownerId, Long id) {
        Form form = load(ownerId, id);
        return FormResponse.from(form);
    }

    /** 공개 렌더용 조회 — 소유자 검증 없이 id 로 리드폼 정의를 반환(비로그인 공개 리드폼). */
    @Transactional(readOnly = true)
    public FormResponse getPublic(Long id) {
        return getPublic(id, null, null);
    }

    /**
     * 공개 렌더 데이터. {@code clientIp} 를 주면 소유자의 전역 접속 차단 규칙을 적용한다
     * (차단 IP 에는 리드폼의 존재조차 알리지 않도록 404). 차단되면 시도 로그를 남긴다.
     */
    @Transactional(readOnly = true)
    public FormResponse getPublic(Long id, String clientIp, String userAgent) {
        Form form = formRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("리드폼을 찾을 수 없습니다."));
        if (clientIp != null) {
            String matched = siteIpBlockService.blockedPattern(form.getOwnerId(), clientIp);
            if (matched != null) {
                siteIpBlockService.recordHit(form.getOwnerId(), clientIp, matched,
                        SiteIpBlockHit.Source.FORM, userAgent);
                throw new NotFoundException("리드폼을 찾을 수 없습니다.");
            }
        }
        // 웹훅 전용 리드폼(V39)은 공개 렌더를 막는다 — 공개 URL 이 살아 있으면 아무나 제출할 수 있고,
        // 그 제출은 진짜 웹훅 리드가 아니다(META-LEADS-PLAN §4-6).
        if (form.getSource() == FormSource.WEBHOOK) {
            throw new NotFoundException("리드폼을 찾을 수 없습니다.");
        }
        // 공개 응답 — 운영 설정(시트 웹훅·시크릿, 알림 번호, 문자 본문 등)은 빼고 내려준다.
        return FormResponse.publicOf(form);
    }

    /** 리드 저장 시 소유권/상태 확인용 — 리드폼 엔티티 로드(없으면 404). */
    @Transactional(readOnly = true)
    public Form getEntity(Long id) {
        return formRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("리드폼을 찾을 수 없습니다."));
    }

    @Transactional
    public FormResponse create(Long ownerId, FormRequest req) {
        Form form = new Form(ownerId, req.name().trim(), req.formType());
        applySettings(form, req);
        form.replaceBlocks(toBlocks(req)); // 새 리드폼은 지울 기존 행이 없다
        formRepository.save(form);
        return FormResponse.from(form);
    }

    @Transactional
    public FormResponse update(Long ownerId, Long id, FormRequest req) {
        Form form = load(ownerId, id);
        form.setName(req.name().trim());
        form.setFormType(req.formType());
        applySettings(form, req);
        // 블록 교체는 2단계로 나눈다 — 기존 행의 DELETE 를 새 행 INSERT 보다 먼저 DB 에 보내야
        // 유지된 변수키(f1 …)가 아직 살아 있는 옛 행과 부딪히지 않는다(Form.addBlocks 주석 참고).
        form.clearBlocks();
        formRepository.flush();
        form.addBlocks(toBlocks(req));
        return FormResponse.from(form);
    }

    /**
     * 리드폼 삭제 — 소속 데이터까지 함께 지운다(영구 삭제, 화면에서 경고 후 진행).
     *
     * <p>🐛 2026-08-09 수정: {@code leads}·{@code ip_blocks}·{@code ip_block_hits} 의 form_id FK 에
     * {@code on delete} 규칙이 없어(V5·V13), 리드가 1건이라도 있으면 DB 가 삭제를 거부해 500 이 났다.
     * 이전 기간(V32 마이그레이션 금지)이라 FK 를 고치는 대신 자식부터 지운다.
     * 리드의 하위(lead_notes·lead_as_requests)는 DB cascade 가, 광고주 권한(grants)도 cascade 가 정리하고,
     * 원장(advertiser_ledger)은 FK 없이 form_id 스냅샷이라 돈 기록은 남는다(의도 — V31 설계).
     */
    @Transactional
    public void delete(Long ownerId, Long id) {
        Form form = load(ownerId, id);
        leadRepository.deleteAllByFormId(id);
        ipBlockHitRepository.deleteByFormId(id);
        ipBlockRepository.deleteByFormId(id);
        formRepository.delete(form);
    }

    private Form load(Long ownerId, Long id) {
        return formRepository.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new NotFoundException("리드폼을 찾을 수 없습니다."));
    }

    /** 요청 DTO → 블록 엔티티 목록(변수키 확정은 Form 이 한다). */
    private List<FormBlock> toBlocks(FormRequest req) {
        return req.blocksOrEmpty().stream().map(FormBlockDto::toEntity).toList();
    }

    /** 요청의 설정을 리드폼에 반영(블록은 별도 — create/update 가 각자 처리한다). */
    private void applySettings(Form form, FormRequest req) {
        form.setCategory(req.category()); // 분야(V34) — 빈 값은 setter 가 null 로
        // ⚠️ source(SELF|WEBHOOK, V39)는 여기서 건드리지 않는다 — 웹훅 설정 API(enable/disableWebhook)로만
        // 바뀐다. FormRequest 에 넣지 않은 이유는 클래스 주석 참고.
        form.setRequirePhoneVerification(Boolean.TRUE.equals(req.requirePhoneVerification()));
        form.setConsentConfig(req.consentConfig());
        form.setSubmitButtonConfig(req.submitButtonConfig());
        form.setSuccessConfig(req.successConfig());
        form.setTypeConfig(req.typeConfig());
        form.setStyleConfig(req.styleConfig());
        // 자동 승인 기준 시각(autoApproveSince)은 서버가 찍는다 — 소급 적용 방지.
        // ⚠️ setSettingsConfig 보다 먼저 계산해야 한다: stamp 가 '저장 전' 설정을 봐야
        //    계속 켜져 있던 리드폼의 기준 시각을 물려받을 수 있다.
        Map<String, Object> settings = AutoApproveSettings.stamp(
                form.getSettingsConfig(), req.settingsConfig(), Instant.now());
        form.setSettingsConfig(sanitizeSmsSettings(form.getOwnerId(), settings));
        form.setTrackingConfig(req.trackingConfig());
    }

    // ---------- 문자 발송 권한 반영 (V25) ----------

    /** 리드폼 설정 중 문자 발송을 켜는 키들. 새 수신자 유형이 생기면 여기에 추가해야 한다. */
    private static final List<String> SMS_TOGGLES =
            List.of("smsMarketerEnabled", "smsAdvertiserEnabled", "smsLeadEnabled");
    /** 첨부가 붙으면 채널이 MMS 로 바뀌므로 MMS 권한이 있어야 저장할 수 있다. */
    private static final String SMS_ATTACHMENT = "smsLeadImageId";

    /**
     * 권한 없는 계정이 문자 발송을 켜 두지 못하게 저장 시점에 정리한다.
     *
     * <p><b>화면만 숨기면 API 직접 호출로 켤 수 있다</b>(docs/PROGRESS.md 문자 권한 절).
     * 최종 관문은 {@code SmsService.send} 지만, 여기서도 막아야 "켜 둔 것처럼 보이는데 안 나가는" 상태를 없앤다.
     *
     * <p><b>⚠️ 거부(예외)가 아니라 강제 false 다.</b> V25 이후 모든 계정이 기본 off 이므로,
     * 예외를 던지면 <b>예전에 켜 둔 리드폼을 아예 저장할 수 없게 된다</b>(마케터가 편집 자체를 못 함).
     * 대신 저장 결과가 응답에 그대로 담기므로 화면에서 꺼진 것을 바로 확인할 수 있다.
     */
    private Map<String, Object> sanitizeSmsSettings(Long ownerId, Map<String, Object> settings) {
        if (settings == null || settings.isEmpty()) {
            return settings;
        }
        User owner = ownerId == null ? null : userRepository.findById(ownerId).orElse(null);
        boolean enabled = SmsPermissions.enabled(owner);
        boolean mmsAllowed = SmsPermissions.channelAllowed(owner, "MMS");
        if (enabled && mmsAllowed) {
            return settings; // 전부 허용된 계정 — 손대지 않는다
        }
        // 요청 맵을 그대로 고치지 않고 복사본을 만든다(호출부의 DTO 를 오염시키지 않는다).
        Map<String, Object> copy = new LinkedHashMap<>(settings);
        if (!enabled) {
            for (String key : SMS_TOGGLES) {
                if (Boolean.TRUE.equals(copy.get(key))) {
                    copy.put(key, false);
                }
            }
        }
        if (!mmsAllowed) {
            copy.remove(SMS_ATTACHMENT);
        }
        return copy;
    }

    /**
     * 웹훅 수신 이력 기록(공개 인바운드 경로 전용, {@code WebhookLeadService} 가 호출).
     * 소유자 검증 없이 formId 로 바로 찾는다 — 공개 웹훅 처리 중이라 이미 토큰으로 폼을 특정한 뒤다.
     * error 가 있으면 lastError 를 남기고, 없으면(성공) 지운다 — 마케터가 매핑을 고쳤는지 바로 알 수 있게.
     */
    @Transactional
    public void recordWebhookReceipt(Long formId, Map<String, Object> payload, Instant at, String error) {
        Form form = formRepository.findById(formId).orElse(null);
        if (form == null) {
            return;
        }
        Map<String, Object> cfg = form.getWebhookConfig() == null
                ? new LinkedHashMap<>() : new LinkedHashMap<>(form.getWebhookConfig());
        cfg.put("lastPayload", payload);
        cfg.put("lastReceivedAt", at.toString());
        if (error != null) {
            cfg.put("lastError", error);
            cfg.put("lastErrorAt", at.toString());
        } else {
            cfg.remove("lastError");
            cfg.remove("lastErrorAt");
        }
        form.setWebhookConfig(cfg);
    }

    // ---------- 웹훅 수신 설정 (V39, 범용 인바운드 — META-LEADS-PLAN.md) ----------

    @Transactional(readOnly = true)
    public WebhookLeadConfigResponse getWebhookConfig(Long ownerId, Long id) {
        Form form = load(ownerId, id);
        return buildWebhookConfigResponse(form);
    }

    /** 웹훅 수신 켜기. 토큰이 없으면 새로 발급(있으면 유지 — 재발급은 별도 API). 토큰 원문은 이 응답에서만 내려간다. */
    @Transactional
    public WebhookTokenResponse enableWebhook(Long ownerId, Long id) {
        Form form = load(ownerId, id);
        form.setSource(FormSource.WEBHOOK);
        if (form.getWebhookTokenHash() != null) {
            // 이미 토큰이 있으면 원문을 다시 보여줄 수 없다(해시만 저장) — 재발급을 안내한다.
            throw new IllegalStateException("이미 웹훅이 설정돼 있습니다. 토큰을 다시 보려면 재발급하세요.");
        }
        String token = WebhookTokens.newToken();
        form.setWebhookTokenHash(WebhookTokens.hash(token));
        return new WebhookTokenResponse(token);
    }

    /** 토큰 재발급(노출됐거나 잊어버렸을 때) — 기존 토큰은 즉시 무효화된다. */
    @Transactional
    public WebhookTokenResponse regenerateWebhookToken(Long ownerId, Long id) {
        Form form = load(ownerId, id);
        String token = WebhookTokens.newToken();
        form.setWebhookTokenHash(WebhookTokens.hash(token));
        return new WebhookTokenResponse(token);
    }

    /** 웹훅 수신 끄기 — SELF 로 되돌린다. 토큰·매핑은 남겨둔다(재활성화 시 다시 설정할 필요 없게). */
    @Transactional
    public void disableWebhook(Long ownerId, Long id) {
        Form form = load(ownerId, id);
        form.setSource(FormSource.SELF);
    }

    /** 원본 키 매핑 저장(마케터 셀프서비스). lastPayload/lastError 등 수신 이력은 건드리지 않는다. */
    @Transactional
    public WebhookLeadConfigResponse saveWebhookMapping(Long ownerId, Long id, WebhookMappingRequest req) {
        Form form = load(ownerId, id);
        Map<String, Object> cfg = form.getWebhookConfig() == null
                ? new LinkedHashMap<>() : new LinkedHashMap<>(form.getWebhookConfig());
        cfg.put("answerMapping", req.answerMappingOrEmpty());
        cfg.put("consentMapping", req.consentMappingOrEmpty());
        cfg.put("externalIdKey", (req.externalIdKey() == null || req.externalIdKey().isBlank())
                ? null : req.externalIdKey().trim());
        form.setWebhookConfig(cfg);
        return buildWebhookConfigResponse(form);
    }

    @SuppressWarnings("unchecked")
    private WebhookLeadConfigResponse buildWebhookConfigResponse(Form form) {
        Map<String, Object> cfg = form.getWebhookConfig();
        Map<String, String> answerMapping = cfg == null ? Map.of()
                : (Map<String, String>) cfg.getOrDefault("answerMapping", Map.of());
        Map<String, String> consentMapping = cfg == null ? Map.of()
                : (Map<String, String>) cfg.getOrDefault("consentMapping", Map.of());
        String externalIdKey = cfg == null ? null : (String) cfg.get("externalIdKey");
        Map<String, Object> lastPayload = cfg == null ? null : (Map<String, Object>) cfg.get("lastPayload");
        String lastReceivedAt = cfg == null ? null : (String) cfg.get("lastReceivedAt");
        String lastError = cfg == null ? null : (String) cfg.get("lastError");
        String lastErrorAt = cfg == null ? null : (String) cfg.get("lastErrorAt");
        return new WebhookLeadConfigResponse(
                form.getSource() == FormSource.WEBHOOK,
                form.getWebhookTokenHash() != null,
                answerMapping,
                consentMapping,
                externalIdKey,
                answerLabels(form),
                consentTitles(form),
                lastPayload,
                lastReceivedAt,
                lastError,
                lastErrorAt);
    }

    /** 매핑 화면 드롭다운용 — 답변을 만드는 항목의 라벨(FIELD)/질문(CHOICE), 등장 순서대로. */
    private List<String> answerLabels(Form form) {
        return form.answerBlocks().stream().map(FormBlock::answerLabel)
                .filter(l -> l != null && !l.isBlank()).toList();
    }

    private List<String> consentTitles(Form form) {
        return form.consentItems().stream()
                .map(it -> it.get("title"))
                .filter(t -> t instanceof String s && !s.isBlank())
                .map(String.class::cast)
                .toList();
    }
}
