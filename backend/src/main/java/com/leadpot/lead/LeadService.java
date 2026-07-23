package com.leadpot.lead;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.form.Form;
import com.leadpot.form.FormService;
import com.leadpot.lead.dto.LeadResponse;
import com.leadpot.lead.dto.LeadSubmitRequest;

/** 리드 수집(공개 제출) + 조회(본인 폼만 K5). */
@Service
public class LeadService {

    private final LeadRepository leadRepository;
    private final FormService formService;

    public LeadService(LeadRepository leadRepository, FormService formService) {
        this.leadRepository = leadRepository;
        this.formService = formService;
    }

    /** 방문자 정보(요청 헤더에서 추출한 값). */
    public record Visitor(String ip, String userAgent, String referer, String language) {
    }

    @Transactional
    public Long submit(LeadSubmitRequest req, Visitor visitor) {
        Form form = formService.getEntity(req.formId());
        validate(form, req);

        Lead lead = new Lead();
        lead.setFormId(form.getId());
        lead.setAnswers(req.answersOrEmpty());
        lead.setConsents(req.consentsOrEmpty());
        lead.setUtm(req.utm());
        lead.setGroupTag(req.groupTag());
        lead.setStatus("NEW");
        lead.setPhoneVerified(false); // 본인인증 연동 전까지 false
        lead.setSubmitterIp(cut(visitor.ip(), 64));
        lead.setUserAgent(cut(visitor.userAgent(), 1024));
        lead.setReferer(cut(visitor.referer(), 1024));
        lead.setLanguage(cut(visitor.language(), 40));
        lead.setDevice(UserAgentParser.device(visitor.userAgent()));
        lead.setOs(UserAgentParser.os(visitor.userAgent()));
        lead.setBrowser(UserAgentParser.browser(visitor.userAgent()));

        leadRepository.save(lead);

        // TODO(통합): 리드 접수 훅 — 추후 구글시트 append / 텔레그램·카톡 알림 발송 지점.
        return lead.getId();
    }

    @Transactional(readOnly = true)
    public List<LeadResponse> list(Long ownerId, Long formId) {
        formService.get(ownerId, formId); // 소유권 확인(아니면 404)
        return leadRepository.findByFormIdOrderByCreatedAtDesc(formId)
                .stream().map(LeadResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public long countByOwner(Long ownerId) {
        return leadRepository.countByOwner(ownerId);
    }

    @Transactional(readOnly = true)
    public long countByForm(Long ownerId, Long formId) {
        formService.get(ownerId, formId);
        return leadRepository.countByFormId(formId);
    }

    /** 필수 입력 항목·필수 동의 검증. */
    private void validate(Form form, LeadSubmitRequest req) {
        List<Map<String, Object>> answers = req.answersOrEmpty();

        form.getBlocks().stream()
                .filter(b -> "FIELD".equals(b.getBlockType().name()) && b.isRequired())
                .forEach(b -> {
                    boolean filled = answers.stream().anyMatch(a ->
                            b.getLabel() != null
                                    && b.getLabel().equals(str(a.get("label")))
                                    && !str(a.get("value")).isBlank());
                    if (!filled) {
                        throw new InvalidSubmissionException("'" + b.getLabel() + "' 항목을 입력해주세요.");
                    }
                });

        for (Map<String, Object> c : req.consentsOrEmpty()) {
            boolean required = Boolean.TRUE.equals(c.get("required"));
            boolean agreed = Boolean.TRUE.equals(c.get("agreed"));
            if (required && !agreed) {
                throw new InvalidSubmissionException("필수 동의 항목에 동의해주세요.");
            }
        }
    }

    private static String str(Object o) {
        return o == null ? "" : o.toString();
    }

    private static String cut(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }
}
