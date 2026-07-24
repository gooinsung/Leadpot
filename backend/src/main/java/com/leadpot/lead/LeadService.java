package com.leadpot.lead;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.form.Form;
import com.leadpot.form.FormService;
import com.leadpot.form.dto.FormBlockDto;
import com.leadpot.form.dto.FormResponse;
import com.leadpot.lead.dto.ImportResult;
import com.leadpot.lead.dto.LeadResponse;
import com.leadpot.lead.dto.LeadSubmitRequest;

/** 리드 수집(공개 제출) + 조회(본인 리드폼만 K5). */
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

    /** 리드 목록. trashed=휴지통 여부, status=상태 필터(빈값=전체), q=답변 값/라벨 부분검색. */
    @Transactional(readOnly = true)
    public List<LeadResponse> list(Long ownerId, Long formId, String status, String q, boolean trashed) {
        formService.get(ownerId, formId); // 소유권 확인(아니면 404)
        List<Lead> base = trashed
                ? leadRepository.findByFormIdAndDeletedAtIsNotNullOrderByCreatedAtDesc(formId)
                : leadRepository.findByFormIdAndDeletedAtIsNullOrderByCreatedAtDesc(formId);
        String st = status == null ? "" : status.trim();
        String needle = q == null ? "" : q.trim().toLowerCase();
        return base.stream()
                .filter(l -> st.isEmpty() || st.equals(l.getStatus()))
                .filter(l -> needle.isEmpty() || matchesQuery(l, needle))
                .map(LeadResponse::from).toList();
    }

    /** 답변 값/라벨에 검색어(소문자)가 포함되는지. */
    private static boolean matchesQuery(Lead l, String needle) {
        if (l.getAnswers() == null) return false;
        for (Map<String, Object> a : l.getAnswers()) {
            if (str(a.get("value")).toLowerCase().contains(needle)
                    || str(a.get("label")).toLowerCase().contains(needle)) {
                return true;
            }
        }
        return false;
    }

    /** 휴지통으로 이동(soft delete). 본인 리드폼의 리드만 K5. */
    @Transactional
    public void softDelete(Long ownerId, Long leadId) {
        Lead lead = requireOwnedLead(ownerId, leadId);
        if (lead.getDeletedAt() == null) {
            lead.setDeletedAt(Instant.now());
        }
    }

    /** 휴지통에서 복원. */
    @Transactional
    public void restore(Long ownerId, Long leadId) {
        requireOwnedLead(ownerId, leadId).setDeletedAt(null);
    }

    /** 영구 삭제(휴지통에서 완전 제거). 되돌릴 수 없음. */
    @Transactional
    public void permanentDelete(Long ownerId, Long leadId) {
        leadRepository.delete(requireOwnedLead(ownerId, leadId));
    }

    private Lead requireOwnedLead(Long ownerId, Long leadId) {
        Lead lead = leadRepository.findById(leadId)
                .orElseThrow(() -> new NotFoundException("리드를 찾을 수 없습니다."));
        formService.get(ownerId, lead.getFormId()); // 소유권 확인(아니면 404)
        return lead;
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

    // 리드 상태(CRM 진행) — 코드/한글
    public static final Set<String> STATUSES = Set.of("NEW", "IN_PROGRESS", "DONE", "SPAM");
    private static final Map<String, String> STATUS_KR = Map.of(
            "NEW", "신규", "IN_PROGRESS", "상담중", "DONE", "완료", "SPAM", "불량");
    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")
            .withZone(ZoneId.of("Asia/Seoul"));

    /** 리드 상태 변경 (본인 리드폼의 리드만 K5). */
    @Transactional
    public void updateStatus(Long ownerId, Long leadId, String status) {
        if (!STATUSES.contains(status)) {
            throw new InvalidSubmissionException("상태 값이 올바르지 않습니다.");
        }
        Lead lead = leadRepository.findById(leadId)
                .orElseThrow(() -> new NotFoundException("리드를 찾을 수 없습니다."));
        formService.get(ownerId, lead.getFormId()); // 소유권 확인(아니면 404)
        lead.setStatus(status);
    }

    /** 리드폼의 리드를 CSV 로 내보낸다(본인 리드폼만). 항목 컬럼은 리드폼 정의 순서. */
    @Transactional(readOnly = true)
    public String exportCsv(Long ownerId, Long formId) {
        FormResponse form = formService.get(ownerId, formId); // 소유권 확인
        // 답변 컬럼(리드폼 블록 순서): FIELD label / CHOICE question
        List<String> answerCols = form.blocks().stream()
                .filter(b -> b.blockType() == com.leadpot.form.BlockType.FIELD
                        || b.blockType() == com.leadpot.form.BlockType.CHOICE)
                .map(LeadService::columnLabel)
                .filter(s -> !s.isBlank())
                .distinct()
                .toList();

        StringBuilder sb = new StringBuilder();
        // 헤더
        sb.append(row(concat(List.of("접수일시", "상태"), answerCols,
                List.of("기기", "OS", "브라우저", "IP", "유입경로", "UTM"))));

        for (Lead l : leadRepository.findByFormIdAndDeletedAtIsNullOrderByCreatedAtDesc(formId)) {
            Map<String, String> ans = new LinkedHashMap<>();
            if (l.getAnswers() != null) {
                for (Map<String, Object> a : l.getAnswers()) {
                    ans.put(str(a.get("label")), str(a.get("value")));
                }
            }
            List<String> cells = new java.util.ArrayList<>();
            cells.add(l.getCreatedAt() != null ? DT.format(l.getCreatedAt()) : "");
            cells.add(STATUS_KR.getOrDefault(l.getStatus(), l.getStatus()));
            for (String col : answerCols) {
                cells.add(ans.getOrDefault(col, ""));
            }
            cells.add(nn(l.getDevice()));
            cells.add(nn(l.getOs()));
            cells.add(nn(l.getBrowser()));
            cells.add(nn(l.getSubmitterIp()));
            cells.add(nn(l.getReferer()));
            cells.add(utmStr(l.getUtm()));
            sb.append(row(cells));
        }
        return sb.toString();
    }

    /** 가져오기 양식의 컬럼(라벨) 목록 — 본인 리드폼만. */
    @Transactional(readOnly = true)
    public List<String> templateColumns(Long ownerId, Long formId) {
        return answerColumnLabels(formService.get(ownerId, formId));
    }

    /** FIELD 라벨 / CHOICE 질문을 순서대로(중복 제거). */
    private static List<String> answerColumnLabels(FormResponse form) {
        return form.blocks().stream()
                .filter(b -> b.blockType() == com.leadpot.form.BlockType.FIELD
                        || b.blockType() == com.leadpot.form.BlockType.CHOICE)
                .map(LeadService::columnLabel)
                .filter(s -> !s.isBlank())
                .distinct()
                .toList();
    }

    /** 엑셀/CSV 행 목록을 리드로 일괄 등록(본인 리드폼만 K5). 행별 검증 실패는 건너뛰고 사유 수집. */
    @Transactional
    public ImportResult importRows(Long ownerId, Long formId, List<Map<String, String>> rows) {
        FormResponse form = formService.get(ownerId, formId); // 소유권 확인(아니면 404)
        List<String> cols = answerColumnLabels(form);
        Map<String, String> typeByLabel = new LinkedHashMap<>();
        Map<String, Boolean> requiredByLabel = new LinkedHashMap<>();
        for (FormBlockDto b : form.blocks()) {
            String label = columnLabel(b);
            if (label.isBlank()) {
                continue;
            }
            if (b.blockType() == com.leadpot.form.BlockType.FIELD) {
                typeByLabel.put(label, b.fieldType() == null ? "text" : b.fieldType());
                requiredByLabel.put(label, Boolean.TRUE.equals(b.required()));
            } else if (b.blockType() == com.leadpot.form.BlockType.CHOICE) {
                Object at = b.content() == null ? null : b.content().get("answerType");
                if (at == null && b.content() != null) {
                    at = b.content().get("selectType");
                }
                typeByLabel.put(label, at == null ? "text" : at.toString());
                requiredByLabel.put(label, b.content() != null && Boolean.TRUE.equals(b.content().get("required")));
            }
        }

        int created = 0;
        List<String> errors = new java.util.ArrayList<>();
        int rownum = 1; // 헤더가 1행, 데이터는 2행부터
        for (Map<String, String> row : rows) {
            rownum++;
            boolean allEmpty = cols.stream().allMatch(c -> str(row.get(c)).isBlank());
            if (allEmpty) {
                continue;
            }
            try {
                List<Map<String, Object>> answers = new java.util.ArrayList<>();
                for (String c : cols) {
                    String v = str(row.get(c)).trim();
                    if (Boolean.TRUE.equals(requiredByLabel.get(c)) && v.isBlank()) {
                        throw new InvalidSubmissionException("'" + c + "' 필수 항목이 비어 있습니다.");
                    }
                    checkFormat(typeByLabel.getOrDefault(c, "text"), v, c);
                    Map<String, Object> a = new LinkedHashMap<>();
                    a.put("label", c);
                    a.put("fieldType", typeByLabel.getOrDefault(c, "text"));
                    a.put("value", v);
                    answers.add(a);
                }
                Lead lead = new Lead();
                lead.setFormId(formId);
                lead.setAnswers(answers);
                lead.setStatus("NEW");
                lead.setPhoneVerified(false);
                lead.setGroupTag("import");
                leadRepository.save(lead);
                created++;
            } catch (InvalidSubmissionException e) {
                errors.add("행 " + rownum + ": " + e.getMessage());
            }
        }
        return new ImportResult(created, errors.size(), errors);
    }

    private static String columnLabel(FormBlockDto b) {
        if (b.blockType() == com.leadpot.form.BlockType.CHOICE) {
            Object q = b.content() == null ? null : b.content().get("question");
            return q == null ? "" : q.toString();
        }
        return b.label() == null ? "" : b.label();
    }

    private static String utmStr(Map<String, Object> utm) {
        if (utm == null || utm.isEmpty()) return "";
        StringBuilder s = new StringBuilder();
        utm.forEach((k, v) -> s.append(s.isEmpty() ? "" : " ").append(k).append("=").append(v));
        return s.toString();
    }

    private static <T> List<String> concat(List<String> a, List<String> b, List<String> c) {
        List<String> out = new java.util.ArrayList<>(a);
        out.addAll(b);
        out.addAll(c);
        return out;
    }

    /** CSV 한 행(각 셀 escape + CRLF). */
    private static String row(List<String> cells) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < cells.size(); i++) {
            if (i > 0) sb.append(',');
            sb.append(csv(cells.get(i)));
        }
        return sb.append("\r\n").toString();
    }

    private static String csv(String v) {
        String s = v == null ? "" : v;
        return "\"" + s.replace("\"", "\"\"") + "\"";
    }

    private static String nn(String s) {
        return s == null ? "" : s;
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

        // 형식 검증(이메일/전화/숫자) — 리드폼 정의의 유형 기준(클라이언트 값 신뢰하지 않음). 값이 있을 때만.
        form.getBlocks().stream()
                .filter(b -> "FIELD".equals(b.getBlockType().name()))
                .forEach(b -> checkFormat(b.getFieldType(), valueByLabel(answers, b.getLabel()), b.getLabel()));
        form.getBlocks().stream()
                .filter(b -> "CHOICE".equals(b.getBlockType().name()) && b.getContent() != null)
                .forEach(b -> {
                    Object at = b.getContent().get("answerType");
                    if (at == null) at = b.getContent().get("selectType");
                    String q = str(b.getContent().get("question"));
                    checkFormat(str(at), valueByLabel(answers, q), q);
                });

        for (Map<String, Object> c : req.consentsOrEmpty()) {
            boolean required = Boolean.TRUE.equals(c.get("required"));
            boolean agreed = Boolean.TRUE.equals(c.get("agreed"));
            if (required && !agreed) {
                throw new InvalidSubmissionException("필수 동의 항목에 동의해주세요.");
            }
        }
    }

    /** 중복 제출 방지(K3): 항목별 중복 불허(기간 내) + 리드폼 레벨 동일 IP 접수 불허. */
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
                    boolean dup = leadRepository.findByFormIdAndCreatedAtGreaterThanEqualAndDeletedAtIsNull(form.getId(), after)
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
            if (leadRepository.existsByFormIdAndSubmitterIpAndCreatedAtGreaterThanEqualAndDeletedAtIsNull(form.getId(), visitor.ip(), after)) {
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

    /** answers 배열에서 label 로 값 찾기(첫 매치). */
    private static String valueByLabel(List<Map<String, Object>> answers, String label) {
        if (label == null || label.isBlank()) return "";
        return answers.stream()
                .filter(a -> label.equals(str(a.get("label"))))
                .map(a -> str(a.get("value")))
                .findFirst().orElse("");
    }

    private static final java.util.regex.Pattern EMAIL_RE =
            java.util.regex.Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final java.util.regex.Pattern TEL_RE =
            java.util.regex.Pattern.compile("^[0-9+\\-()\\s]+$");
    private static final java.util.regex.Pattern NUMBER_RE =
            java.util.regex.Pattern.compile("^-?\\d+(\\.\\d+)?$");

    /** 유형별 형식 검증(이메일/전화/숫자). 값이 비어 있으면 통과(필수 검증은 별도). */
    private void checkFormat(String fieldType, String value, String label) {
        String v = value == null ? "" : value.trim();
        if (v.isEmpty()) return;
        String type = fieldType == null ? "" : fieldType;
        String name = (label == null || label.isBlank()) ? "이 항목" : label;
        switch (type) {
            case "email" -> {
                if (!EMAIL_RE.matcher(v).matches()) {
                    throw new InvalidSubmissionException("'" + name + "' 이메일 형식이 올바르지 않습니다.");
                }
            }
            case "tel" -> {
                String digits = v.replaceAll("\\D", "");
                if (!TEL_RE.matcher(v).matches() || digits.length() < 9 || digits.length() > 15) {
                    throw new InvalidSubmissionException("'" + name + "' 연락처는 숫자로 올바르게 입력해주세요.");
                }
            }
            case "number" -> {
                if (!NUMBER_RE.matcher(v).matches()) {
                    throw new InvalidSubmissionException("'" + name + "' 는 숫자만 입력할 수 있습니다.");
                }
            }
            default -> {
                // text/textarea/select/date/single/multi 등은 형식 제약 없음
            }
        }
    }

    private static String cut(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }
}
