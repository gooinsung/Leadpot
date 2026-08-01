package com.leadpot.form;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.common.error.NotFoundException;
import com.leadpot.form.dto.FormBlockDto;
import com.leadpot.form.dto.FormRequest;
import com.leadpot.form.dto.FormResponse;
import com.leadpot.form.dto.FormSummary;
import com.leadpot.ipblock.SiteIpBlockService;

/** 리드폼 CRUD. 모든 조회/수정은 소유자(ownerId) 기준으로 제한한다(K5). */
@Service
public class FormService {

    private final FormRepository formRepository;
    private final SiteIpBlockService siteIpBlockService;

    public FormService(FormRepository formRepository, SiteIpBlockService siteIpBlockService) {
        this.formRepository = formRepository;
        this.siteIpBlockService = siteIpBlockService;
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
        return getPublic(id, null);
    }

    /**
     * 공개 렌더 데이터. {@code clientIp} 를 주면 소유자의 전역 접속 차단 규칙을 적용한다
     * (차단 IP 에는 리드폼의 존재조차 알리지 않도록 404).
     */
    @Transactional(readOnly = true)
    public FormResponse getPublic(Long id, String clientIp) {
        Form form = formRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("리드폼을 찾을 수 없습니다."));
        if (clientIp != null && siteIpBlockService.isBlocked(form.getOwnerId(), clientIp)) {
            throw new NotFoundException("리드폼을 찾을 수 없습니다.");
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
        apply(form, req);
        formRepository.save(form);
        return FormResponse.from(form);
    }

    @Transactional
    public FormResponse update(Long ownerId, Long id, FormRequest req) {
        Form form = load(ownerId, id);
        form.setName(req.name().trim());
        form.setFormType(req.formType());
        apply(form, req);
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

    /** 요청의 설정/블록을 리드폼에 반영. */
    private void apply(Form form, FormRequest req) {
        form.setRequirePhoneVerification(Boolean.TRUE.equals(req.requirePhoneVerification()));
        form.setConsentConfig(req.consentConfig());
        form.setSubmitButtonConfig(req.submitButtonConfig());
        form.setSuccessConfig(req.successConfig());
        form.setTypeConfig(req.typeConfig());
        form.setStyleConfig(req.styleConfig());
        form.setSettingsConfig(req.settingsConfig());
        form.setTrackingConfig(req.trackingConfig());
        List<FormBlock> blocks = req.blocksOrEmpty().stream().map(FormBlockDto::toEntity).toList();
        form.replaceBlocks(blocks);
    }
}
