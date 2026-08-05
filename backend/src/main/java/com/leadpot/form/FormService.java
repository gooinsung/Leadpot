package com.leadpot.form;

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
import com.leadpot.ipblock.SiteIpBlockHit;
import com.leadpot.ipblock.SiteIpBlockService;
import com.leadpot.sms.SmsPermissions;

/** 리드폼 CRUD. 모든 조회/수정은 소유자(ownerId) 기준으로 제한한다(K5). */
@Service
public class FormService {

    private final FormRepository formRepository;
    private final SiteIpBlockService siteIpBlockService;
    private final UserRepository userRepository;

    public FormService(FormRepository formRepository, SiteIpBlockService siteIpBlockService,
            UserRepository userRepository) {
        this.formRepository = formRepository;
        this.siteIpBlockService = siteIpBlockService;
        this.userRepository = userRepository;
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
        return FormResponse.from(form);
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

    @Transactional
    public void delete(Long ownerId, Long id) {
        Form form = load(ownerId, id);
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
        form.setRequirePhoneVerification(Boolean.TRUE.equals(req.requirePhoneVerification()));
        form.setConsentConfig(req.consentConfig());
        form.setSubmitButtonConfig(req.submitButtonConfig());
        form.setSuccessConfig(req.successConfig());
        form.setTypeConfig(req.typeConfig());
        form.setStyleConfig(req.styleConfig());
        form.setSettingsConfig(sanitizeSmsSettings(form.getOwnerId(), req.settingsConfig()));
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
}
