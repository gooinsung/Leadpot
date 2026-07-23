package com.leadpot.lead;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
        checkDuplicates(form, req, visitor);

        Lead lead = new Lead();
        lead.setFormId(form.getId());
        lead.setLandingPageId(req.landingPageId());
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

        // STEP 필수 질문(CHOICE, content.required=true) 검증 — 질문(label) 기준
        form.getBlocks().stream()
                .filter(b -> "CHOICE".equals(b.getBlockType().name()) && b.getContent() != null
                        && Boolean.TRUE.equals(b.getContent().get("required")))
                .forEach(b -> {
                    String q = str(b.getContent().get("question"));
                    boolean filled = answers.stream().anyMatch(a ->
                            !q.isBlank() && q.equals(str(a.get("label"))) && !str(a.get("value")).isBlank());
                    if (!filled) {
                        throw new InvalidSubmissionException("'" + q + "' 질문에 응답해주세요.");
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

    /** 중복 제출 방지(K3): 항목별 중복 불허(기간 내) + 폼 레벨 동일 IP 접수 불허. */
    private void checkDuplicates(Form form, LeadSubmitRequest req, Visitor visitor) {
        List<Map<String, Object>> answers = req.answersOrEmpty();

        // 1) 항목별 중복 검사 — options.allowDuplicate == false 인 FIELD
        form.getBlocks().stream()
                .filter(b -> "FIELD".equals(b.getBlockType().name()) && b.getOptions() != null
                        && Boolean.FALSE.equals(b.getOptions().get("allowDuplicate")))
                .forEach(b -> {
                    String label = b.getLabel();
                    String value = answers.stream()
                            .filter(a -> label != null && label.equals(str(a.get("label"))))
                            .map(a -> str(a.get("value"))).findFirst().orElse("");
                    if (value.isBlank()) return;
                    Instant after = windowStart(days(b.getOptions().get("dedupDays")));
                    boolean dup = leadRepository.findByFormIdAndCreatedAtGreaterThanEqual(form.getId(), after)
                            .stream().anyMatch(l -> l.getAnswers() != null && l.getAnswers().stream()
                                    .anyMatch(a -> label.equals(str(a.get("label"))) && value.equals(str(a.get("value")))));
                    if (dup) {
                        throw new InvalidSubmissionException("이미 접수된 " + label + "입니다.");
                    }
                });

        // 2) 동일 IP 접수 불허 — settingsConfig.allowSameIp == false
        Map<String, Object> settings = form.getSettingsConfig();
        if (settings != null && Boolean.FALSE.equals(settings.get("allowSameIp"))
                && visitor.ip() != null && !visitor.ip().isBlank()) {
            Instant after = windowStart(days(settings.get("ipDedupDays")));
            if (leadRepository.existsByFormIdAndSubmitterIpAndCreatedAtGreaterThanEqual(form.getId(), visitor.ip(), after)) {
                throw new InvalidSubmissionException("이미 접수된 요청입니다. (동일 IP에서 중복 제출)");
            }
        }
    }

    private static int days(Object o) {
        if (o instanceof Number n) return n.intValue();
        try {
            return o == null ? 0 : Integer.parseInt(o.toString());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static Instant windowStart(int days) {
        return days > 0 ? Instant.now().minus(days, ChronoUnit.DAYS) : Instant.EPOCH;
    }

    private static String str(Object o) {
        return o == null ? "" : o.toString();
    }

    private static String cut(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }
}
