package com.leadpot.lead;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.form.Form;
import com.leadpot.form.FormBlock;
import com.leadpot.form.FormService;
import com.leadpot.form.dto.FormBlockDto;
import com.leadpot.form.dto.FormResponse;
import com.leadpot.form.dto.FormSummary;
import com.leadpot.integration.NotificationService;
import com.leadpot.ipblock.IpBlockService;
import com.leadpot.ipblock.SiteIpBlockService;
import com.leadpot.lead.dto.ImportResult;
import com.leadpot.lead.dto.InboxResponse;
import com.leadpot.lead.dto.LeadNoteResponse;
import com.leadpot.lead.dto.LeadResponse;
import com.leadpot.lead.dto.LeadSubmitRequest;

/** 리드 수집(공개 제출) + 조회(본인 리드폼만 K5). */
@Service
public class LeadService {

    private final LeadRepository leadRepository;
    private final LeadNoteRepository leadNoteRepository;
    private final FormService formService;
    private final IpBlockService ipBlockService;
    private final SiteIpBlockService siteIpBlockService;
    private final NotificationService notificationService;

    public LeadService(LeadRepository leadRepository, LeadNoteRepository leadNoteRepository,
            FormService formService, IpBlockService ipBlockService, NotificationService notificationService,
            SiteIpBlockService siteIpBlockService) {
        this.leadRepository = leadRepository;
        this.leadNoteRepository = leadNoteRepository;
        this.formService = formService;
        this.ipBlockService = ipBlockService;
        this.notificationService = notificationService;
        this.siteIpBlockService = siteIpBlockService;
    }

    /** 방문자 정보(요청 헤더에서 추출한 값). */
    public record Visitor(String ip, String userAgent, String referer, String language) {
    }

    @Transactional
    public Long submit(LeadSubmitRequest req, Visitor visitor) {
        Form form = formService.getEntity(req.formId());
        checkIpBlocked(form, visitor);
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

        // 리드 접수 훅 — 커밋 후 비동기로 텔레그램/구글시트 알림(best-effort). 접수를 방해하지 않는다.
        notificationService.notifyNewLead(form, lead, () -> isLikelyDuplicate(form, req));
        return lead.getId();
    }

    /**
     * 알림용 중복 판정: 신원 식별 항목(연락처·이메일 유형 또는 중복 불허 항목)의 값이
     * 이 리드폼의 기존(휴지통 제외) 리드에 이미 있으면 중복으로 본다. best-effort — 실패 시 false.
     */
    private boolean isLikelyDuplicate(Form form, LeadSubmitRequest req) {
        try {
            List<Map<String, Object>> answers = req.answersOrEmpty();
            List<String> identityLabels = form.getBlocks().stream()
                    .filter(b -> "FIELD".equals(b.getBlockType().name()))
                    .filter(b -> {
                        String ft = b.getFieldType();
                        boolean contact = "tel".equals(ft) || "email".equals(ft);
                        boolean noDup = b.getOptions() != null
                                && Boolean.FALSE.equals(b.getOptions().get("allowDuplicate"));
                        return contact || noDup;
                    })
                    .map(FormBlock::getLabel)
                    .filter(l -> l != null && !l.isBlank())
                    .toList();
            if (identityLabels.isEmpty()) {
                return false;
            }
            List<Lead> existing = leadRepository.findByFormIdAndDeletedAtIsNullOrderByCreatedAtDesc(form.getId());
            for (String label : identityLabels) {
                String value = valueByLabel(answers, label);
                if (value.isBlank()) {
                    continue;
                }
                boolean dup = existing.stream().anyMatch(l -> l.getAnswers() != null && l.getAnswers().stream()
                        .anyMatch(a -> label.equals(str(a.get("label"))) && value.equals(str(a.get("value")))));
                if (dup) {
                    return true;
                }
            }
            return false;
        } catch (RuntimeException e) {
            return false;
        }
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

    // ---------- 통합 인박스 (U1) ----------

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final String STATUS_NEW = "NEW";
    private static final int INBOX_DEFAULT_SIZE = 25;
    private static final int INBOX_MAX_SIZE = 100;

    /**
     * 통합 인박스: 내 <b>모든 리드폼의 활성 리드</b>를 한 스트림으로. 필터(상태·검색·출처폼·기간·미확인)·페이징.
     * 왼쪽 rail 카운트는 <b>필터와 무관하게 전체 기준</b>으로 계산한다. "미확인" = 상태 {@code NEW}(신규).
     */
    @Transactional(readOnly = true)
    public InboxResponse inbox(Long ownerId, String status, String q, Long formId,
            String from, String to, boolean unseen, Integer page, Integer size) {
        // 1) 내 폼(formId → 이름)
        Map<Long, String> nameById = new LinkedHashMap<>();
        for (FormSummary f : formService.list(ownerId)) {
            nameById.put(f.id(), f.name());
        }
        int pageSize = size == null || size <= 0 ? INBOX_DEFAULT_SIZE : Math.min(size, INBOX_MAX_SIZE);
        if (nameById.isEmpty()) {
            return new InboxResponse(List.of(), 0, 0, pageSize,
                    new InboxResponse.Counts(0, 0, 0, List.of(), Map.of()));
        }
        List<Long> formIds = new ArrayList<>(nameById.keySet());

        // 2) 전체 활성 리드(최신순)
        List<Lead> all = leadRepository.findByFormIdInAndDeletedAtIsNullOrderByCreatedAtDesc(formIds);

        // 3) 카운트 — 전체 기준(rail 숫자용)
        Instant todayStart = LocalDate.now(KST).atStartOfDay(KST).toInstant();
        long unseenCount = 0;
        long todayCount = 0;
        Map<Long, Long> perForm = new LinkedHashMap<>();
        formIds.forEach(id -> perForm.put(id, 0L));
        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (Lead l : all) {
            String s = l.getStatus() == null ? STATUS_NEW : l.getStatus();
            byStatus.merge(s, 1L, Long::sum);
            if (STATUS_NEW.equals(s)) {
                unseenCount++;
            }
            if (l.getCreatedAt() != null && !l.getCreatedAt().isBefore(todayStart)) {
                todayCount++;
            }
            perForm.merge(l.getFormId(), 1L, Long::sum);
        }
        List<InboxResponse.FormCount> byForm = new ArrayList<>();
        for (Long id : formIds) {
            byForm.add(new InboxResponse.FormCount(id, nameById.get(id), perForm.getOrDefault(id, 0L)));
        }

        // 4) 필터
        Instant fromAt = startOfDay(from);
        Instant toAt = endOfDay(to);
        String st = status == null ? "" : status.trim();
        String needle = q == null ? "" : q.trim().toLowerCase();
        List<Lead> filtered = new ArrayList<>();
        for (Lead l : all) {
            String s = l.getStatus() == null ? STATUS_NEW : l.getStatus();
            if (formId != null && !formId.equals(l.getFormId())) {
                continue;
            }
            if (unseen && !STATUS_NEW.equals(s)) {
                continue;
            }
            if (!st.isEmpty() && !st.equals(s)) {
                continue;
            }
            if (fromAt != null && l.getCreatedAt() != null && l.getCreatedAt().isBefore(fromAt)) {
                continue;
            }
            if (toAt != null && l.getCreatedAt() != null && !l.getCreatedAt().isBefore(toAt)) {
                continue;
            }
            if (!needle.isEmpty() && !matchesQuery(l, needle)) {
                continue;
            }
            filtered.add(l);
        }

        // 5) 페이징
        int pageIndex = page == null || page < 0 ? 0 : page;
        int start = Math.min(pageIndex * pageSize, filtered.size());
        int end = Math.min(start + pageSize, filtered.size());
        List<InboxResponse.Item> items = filtered.subList(start, end).stream()
                .map(l -> new InboxResponse.Item(l.getId(), l.getFormId(), nameById.get(l.getFormId()),
                        l.getAnswers(), l.getStatus(), l.getTags(), l.getCreatedAt()))
                .toList();

        return new InboxResponse(items, filtered.size(), pageIndex, pageSize,
                new InboxResponse.Counts(all.size(), unseenCount, todayCount, byForm, byStatus));
    }

    private static Instant startOfDay(String date) {
        if (date == null || date.isBlank()) {
            return null;
        }
        return LocalDate.parse(date.trim()).atStartOfDay(KST).toInstant();
    }

    private static Instant endOfDay(String date) {
        if (date == null || date.isBlank()) {
            return null;
        }
        return LocalDate.parse(date.trim()).plusDays(1).atStartOfDay(KST).toInstant();
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

    /** 리드 상태 변경 (본인 리드폼의 리드만 K5). 변경 이력을 자동 메모(SYSTEM)로 남긴다. */
    @Transactional
    public void updateStatus(Long ownerId, Long leadId, String status) {
        if (!STATUSES.contains(status)) {
            throw new InvalidSubmissionException("상태 값이 올바르지 않습니다.");
        }
        Lead lead = leadRepository.findById(leadId)
                .orElseThrow(() -> new NotFoundException("리드를 찾을 수 없습니다."));
        formService.get(ownerId, lead.getFormId()); // 소유권 확인(아니면 404)
        String before = lead.getStatus();
        if (!status.equals(before)) {
            lead.setStatus(status);
            leadNoteRepository.save(new LeadNote(leadId, ownerId, LeadNote.KIND_SYSTEM,
                    "상태 변경: " + STATUS_KR.getOrDefault(before, before) + " → " + STATUS_KR.getOrDefault(status, status)));
        }
    }

    /**
     * 일괄 상태변경(U2). 내 것이 아닌 id 는 건너뛴다(부분 성공). 실제 변경 건수를 돌려준다.
     * 각 건은 {@link #updateStatus} 를 재사용해 상태 변경 이력(SYSTEM 메모)도 남긴다.
     */
    @Transactional
    public int bulkUpdateStatus(Long ownerId, List<Long> ids, String status) {
        if (!STATUSES.contains(status)) {
            throw new InvalidSubmissionException("상태 값이 올바르지 않습니다.");
        }
        if (ids == null || ids.isEmpty()) {
            return 0;
        }
        int n = 0;
        for (Long id : ids) {
            try {
                updateStatus(ownerId, id, status); // 소유권 확인 + 이력 기록 재사용(자기호출이라 별도 tx 아님)
                n++;
            } catch (NotFoundException ignored) {
                // 내 리드가 아니면 조용히 건너뛴다(부분 성공).
            }
        }
        return n;
    }

    /** 일괄 휴지통 이동(U2). 내 것이 아닌 id 는 건너뛴다. 실제 처리 건수를 돌려준다. */
    @Transactional
    public int bulkSoftDelete(Long ownerId, List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return 0;
        }
        int n = 0;
        for (Long id : ids) {
            try {
                softDelete(ownerId, id);
                n++;
            } catch (NotFoundException ignored) {
                // 내 리드가 아니면 건너뛴다.
            }
        }
        return n;
    }

    // ---------- 리드 상세 / 메모(이력) / 태그 (본인 리드폼만 K5) ----------

    /** 리드 단건 상세(본인 리드폼만). */
    @Transactional(readOnly = true)
    public LeadResponse getOne(Long ownerId, Long leadId) {
        return LeadResponse.from(requireOwnedLead(ownerId, leadId));
    }

    /** 리드 메모/이력 목록(오래된 순). */
    @Transactional(readOnly = true)
    public List<LeadNoteResponse> listNotes(Long ownerId, Long leadId) {
        requireOwnedLead(ownerId, leadId);
        return leadNoteRepository.findByLeadIdOrderByCreatedAtAsc(leadId)
                .stream().map(LeadNoteResponse::from).toList();
    }

    /** 사용자 메모 추가. */
    @Transactional
    public LeadNoteResponse addNote(Long ownerId, Long leadId, String body) {
        requireOwnedLead(ownerId, leadId);
        String text = body == null ? "" : body.trim();
        if (text.isEmpty()) {
            throw new InvalidSubmissionException("메모 내용을 입력해주세요.");
        }
        LeadNote note = leadNoteRepository.save(new LeadNote(leadId, ownerId, LeadNote.KIND_MEMO, text));
        return LeadNoteResponse.from(note);
    }

    /** 메모 삭제(사용자 메모만 삭제 가능, 자동 이력(SYSTEM)은 보존). */
    @Transactional
    public void deleteNote(Long ownerId, Long leadId, Long noteId) {
        requireOwnedLead(ownerId, leadId);
        LeadNote note = leadNoteRepository.findById(noteId)
                .orElseThrow(() -> new NotFoundException("메모를 찾을 수 없습니다."));
        if (!leadId.equals(note.getLeadId()) || !ownerId.equals(note.getOwnerId())) {
            throw new NotFoundException("메모를 찾을 수 없습니다.");
        }
        if (LeadNote.KIND_SYSTEM.equals(note.getKind())) {
            throw new InvalidSubmissionException("자동 이력은 삭제할 수 없습니다.");
        }
        leadNoteRepository.delete(note);
    }

    /** 리드 태그 교체(공백 제거·중복 제거, 최대 20개·각 40자). */
    @Transactional
    public LeadResponse updateTags(Long ownerId, Long leadId, List<String> tags) {
        Lead lead = requireOwnedLead(ownerId, leadId);
        List<String> cleaned = new java.util.ArrayList<>();
        if (tags != null) {
            for (String t : tags) {
                String v = t == null ? "" : t.trim();
                if (!v.isEmpty() && !cleaned.contains(v)) {
                    cleaned.add(cut(v, 40));
                }
                if (cleaned.size() >= 20) {
                    break;
                }
            }
        }
        lead.setTags(cleaned.isEmpty() ? null : cleaned);
        return LeadResponse.from(lead);
    }

    // 방문자정보 등 고정 컬럼(답변 컬럼은 이 사이에 리드폼 순서대로 들어감).
    private static final List<String> META_HEAD = List.of("접수일시", "상태");
    private static final List<String> META_TAIL = List.of("기기", "OS", "브라우저", "IP", "유입경로", "UTM");

    /** 내보내기 가능한 전체 컬럼(순서: 접수일시·상태 → 답변항목 → 방문자정보). 컬럼 선택 UI용. */
    @Transactional(readOnly = true)
    public List<String> exportColumns(Long ownerId, Long formId) {
        FormResponse form = formService.get(ownerId, formId); // 소유권 확인
        return concat(META_HEAD, answerColumnLabels(form), META_TAIL);
    }

    /**
     * 리드 내보내기용 표(0행=헤더). selected 가 비면 전체 컬럼, 아니면 그 컬럼만(원 순서 유지).
     * ids 가 비면 전체 리드, 아니면 그 리드만(본인 리드폼 범위 내 · 화면 필터 반영).
     */
    @Transactional(readOnly = true)
    public List<List<String>> exportMatrix(Long ownerId, Long formId, List<String> selected, List<Long> ids) {
        FormResponse form = formService.get(ownerId, formId); // 소유권 확인
        List<String> answerCols = answerColumnLabels(form);
        List<String> all = concat(META_HEAD, answerCols, META_TAIL);
        List<String> cols = (selected == null || selected.isEmpty())
                ? all
                : all.stream().filter(selected::contains).toList(); // 선택된 것만, 원래 순서 유지
        if (cols.isEmpty()) {
            cols = all; // 유효 컬럼이 하나도 없으면 전체로 폴백
        }
        Set<Long> idSet = (ids == null || ids.isEmpty()) ? null : new java.util.HashSet<>(ids);

        List<List<String>> matrix = new java.util.ArrayList<>();
        matrix.add(new java.util.ArrayList<>(cols)); // 헤더
        for (Lead l : leadRepository.findByFormIdAndDeletedAtIsNullOrderByCreatedAtDesc(formId)) {
            if (idSet != null && !idSet.contains(l.getId())) {
                continue; // 선택된 리드만
            }
            Map<String, String> vals = leadValues(l, answerCols);
            List<String> cells = new java.util.ArrayList<>(cols.size());
            for (String col : cols) {
                cells.add(vals.getOrDefault(col, ""));
            }
            matrix.add(cells);
        }
        return matrix;
    }

    /** 한 리드의 전체 컬럼값 맵(컬럼명 → 값). */
    private static Map<String, String> leadValues(Lead l, List<String> answerCols) {
        Map<String, String> ans = new LinkedHashMap<>();
        if (l.getAnswers() != null) {
            for (Map<String, Object> a : l.getAnswers()) {
                ans.put(str(a.get("label")), str(a.get("value")));
            }
        }
        Map<String, String> m = new LinkedHashMap<>();
        m.put("접수일시", l.getCreatedAt() != null ? DT.format(l.getCreatedAt()) : "");
        m.put("상태", STATUS_KR.getOrDefault(l.getStatus(), l.getStatus()));
        for (String col : answerCols) {
            m.put(col, ans.getOrDefault(col, ""));
        }
        m.put("기기", nn(l.getDevice()));
        m.put("OS", nn(l.getOs()));
        m.put("브라우저", nn(l.getBrowser()));
        m.put("IP", nn(l.getSubmitterIp()));
        m.put("유입경로", nn(l.getReferer()));
        m.put("UTM", utmStr(l.getUtm()));
        return m;
    }

    /** 리드를 CSV 문자열로(선택 컬럼·선택 리드, 생략 시 전체). */
    @Transactional(readOnly = true)
    public String exportCsv(Long ownerId, Long formId, List<String> selected, List<Long> ids) {
        StringBuilder sb = new StringBuilder();
        for (List<String> r : exportMatrix(ownerId, formId, selected, ids)) {
            sb.append(row(r));
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

    /** IP 차단(K2): 차단된 IP면 제출을 거부하고 시도 로그를 남긴다(별도 트랜잭션). */
    private void checkIpBlocked(Form form, Visitor visitor) {
        String ip = visitor.ip();
        // 계정 전역 접속 차단이 걸린 IP 는 제출도 막는다 —
        // 외부 사이트 임베드는 우리 랜딩을 거치지 않으므로 여기서도 확인해야 실제로 차단된다.
        if (siteIpBlockService.isBlocked(form.getOwnerId(), ip)) {
            throw new InvalidSubmissionException("제출이 처리되지 않았습니다. 잠시 후 다시 시도해주세요.");
        }
        String matched = ipBlockService.blockedPattern(form.getId(), ip);
        if (matched != null) {
            // 제출 트랜잭션은 롤백되지만 로그는 REQUIRES_NEW 로 남는다.
            ipBlockService.recordHit(form.getId(), ip, matched, visitor.userAgent(), visitor.referer());
            // 차단 사실을 방문자에게 그대로 알리지 않도록 중립적 메시지 사용.
            throw new InvalidSubmissionException("제출이 처리되지 않았습니다. 잠시 후 다시 시도해주세요.");
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
