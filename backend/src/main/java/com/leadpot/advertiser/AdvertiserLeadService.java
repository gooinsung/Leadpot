package com.leadpot.advertiser;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.advertiser.dto.AdvertiserFormResponse;
import com.leadpot.advertiser.dto.AdvertiserLeadPage;
import com.leadpot.advertiser.dto.AdvertiserLeadResponse;
import com.leadpot.advertiser.dto.AdvertiserMeResponse;
import com.leadpot.advertiser.dto.AdvertiserNoteResponse;
import com.leadpot.advertiser.dto.AdvertiserReportResponse;
import com.leadpot.auth.Role;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.common.error.PlanLimitExceededException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadNote;
import com.leadpot.lead.LeadNoteRepository;
import com.leadpot.lead.LeadRepository;

/**
 * 광고주가 자기에게 부여된 리드를 조회·처리하는 서비스.
 *
 * <h3>보안 설계</h3>
 * <ul>
 * <li><b>단일 관문</b> {@link #requireGrant} — 모든 조회·수정이 이 메서드를 통과한다.
 * grant 존재 · 만료 · 계정 활성 · 소속 마케터 일치 · 폼 소유자 일치를 한 번에 검증한다.</li>
 * <li><b>삭제 기능 없음</b> — 휴지통·복원·영구삭제·가져오기·태그편집 메서드를 아예 만들지 않는다.
 * 권한 플래그로 막는 것보다 코드가 존재하지 않는 것이 확실하다(사용자 지시: 엄격하게).</li>
 * <li>응답은 {@link AdvertiserLeadResponse} 화이트리스트 DTO 만 사용한다(IP·UTM·태그 등 차단).</li>
 * </ul>
 */
@Service
public class AdvertiserLeadService {

    /** 한 번에 가져갈 수 있는 최대 건수 — 대량 추출 방어. */
    private static final int MAX_PAGE_SIZE = 100;
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter DT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(KST);

    private final UserRepository userRepository;
    private final FormRepository formRepository;
    private final AdvertiserFormGrantRepository grantRepository;
    private final LeadRepository leadRepository;
    private final LeadNoteRepository noteRepository;
    private final AdvertiserAuditService audit;
    private final AdvertiserAccessLogRepository accessLogRepository;
    /** 광고주 리드 내보내기 일일 횟수 상한(유출 방어). 0 이하면 무제한. */
    private final int exportDailyMax;

    public AdvertiserLeadService(UserRepository userRepository,
            FormRepository formRepository,
            AdvertiserFormGrantRepository grantRepository,
            LeadRepository leadRepository,
            LeadNoteRepository noteRepository,
            AdvertiserAuditService audit,
            AdvertiserAccessLogRepository accessLogRepository,
            @Value("${app.advertiser.export-daily-max:20}") int exportDailyMax) {
        this.userRepository = userRepository;
        this.formRepository = formRepository;
        this.grantRepository = grantRepository;
        this.leadRepository = leadRepository;
        this.noteRepository = noteRepository;
        this.audit = audit;
        this.accessLogRepository = accessLogRepository;
        this.exportDailyMax = exportDailyMax;
    }

    // ---------- 단일 관문 ----------

    /**
     * 이 광고주가 이 리드폼에 접근할 수 있는지 검증하고 grant 를 반환한다.
     * 조건 하나라도 어긋나면 404(존재 노출 방지).
     */
    @Transactional(readOnly = true)
    public AdvertiserFormGrant requireGrant(Long advertiserId, Long formId) {
        User advertiser = loadActiveAdvertiser(advertiserId);
        AdvertiserFormGrant grant = grantRepository.findByFormId(formId)
                .filter(g -> g.getAdvertiserId().equals(advertiserId))
                .filter(g -> g.isEffective(Instant.now()))
                .orElseThrow(() -> new NotFoundException("리드폼을 찾을 수 없습니다."));
        // 폼이 실제로 내 소속 마케터의 것인지 재확인(광고주가 다른 마케터로 옮겨간 경우 등 방어)
        formRepository.findByIdAndOwnerId(formId, advertiser.getParentUserId())
                .orElseThrow(() -> new NotFoundException("리드폼을 찾을 수 없습니다."));
        return grant;
    }

    private User loadActiveAdvertiser(Long advertiserId) {
        User advertiser = userRepository.findById(advertiserId)
                .filter(u -> u.getRole() == Role.ADVERTISER)
                .filter(User::isActive)
                .orElseThrow(() -> new NotFoundException("계정을 찾을 수 없습니다."));
        if (advertiser.getParentUserId() == null) {
            throw new NotFoundException("계정을 찾을 수 없습니다.");
        }
        return advertiser;
    }

    // ---------- 내 정보 / 폼 목록 ----------

    @Transactional(readOnly = true)
    public AdvertiserMeResponse me(Long advertiserId) {
        User advertiser = loadActiveAdvertiser(advertiserId);
        User marketer = userRepository.findById(advertiser.getParentUserId())
                .orElseThrow(() -> new NotFoundException("담당 마케터를 찾을 수 없습니다."));
        return new AdvertiserMeResponse(advertiser.getId(), advertiser.getEmail(), advertiser.getName(),
                advertiser.getCompany(), marketer.getName(), marketer.getCompany(),
                marketer.getBrandLogoUrl(), marketer.getBrandColor());
    }

    /** 권한 받은 리드폼 목록(+접수 건수·미확인 건수). 만료된 권한은 제외된다. */
    @Transactional(readOnly = true)
    public List<AdvertiserFormResponse> forms(Long advertiserId) {
        User advertiser = loadActiveAdvertiser(advertiserId);
        Instant now = Instant.now();
        List<AdvertiserFormResponse> out = new ArrayList<>();
        for (AdvertiserFormGrant grant : grantRepository.findByAdvertiserId(advertiserId)) {
            if (!grant.isEffective(now)) {
                continue;
            }
            Form form = formRepository.findByIdAndOwnerId(grant.getFormId(), advertiser.getParentUserId())
                    .orElse(null);
            if (form == null) {
                continue;
            }
            List<Lead> leads = leadRepository
                    .findByFormIdAndDeletedAtIsNullOrderByCreatedAtDesc(grant.getFormId());
            long unseen = leads.stream().filter(l -> l.getAdvertiserSeenAt() == null).count();
            String name = grant.getDisplayName() != null && !grant.getDisplayName().isBlank()
                    ? grant.getDisplayName()
                    : form.getName();
            out.add(new AdvertiserFormResponse(form.getId(), name, leads.size(), unseen,
                    grant.isCanStatus(), grant.isCanMemo(), grant.isCanExport()));
        }
        return out;
    }

    /** 대시보드 요약: 전체 미확인 건수 + 오늘 접수 + 상태 분포. */
    @Transactional(readOnly = true)
    public Map<String, Object> dashboard(Long advertiserId) {
        User advertiser = loadActiveAdvertiser(advertiserId);
        Instant now = Instant.now();
        Instant todayStart = LocalDate.now(KST).atStartOfDay(KST).toInstant();

        long unseen = 0;
        long today = 0;
        long total = 0;
        Map<String, Long> byStatus = new HashMap<>();
        for (String s : AdvertiserLeadStatus.VALUES) {
            byStatus.put(s, 0L);
        }
        for (AdvertiserFormGrant grant : grantRepository.findByAdvertiserId(advertiserId)) {
            if (!grant.isEffective(now)
                    || formRepository.findByIdAndOwnerId(grant.getFormId(), advertiser.getParentUserId()).isEmpty()) {
                continue;
            }
            for (Lead lead : leadRepository.findByFormIdAndDeletedAtIsNullOrderByCreatedAtDesc(grant.getFormId())) {
                total++;
                if (lead.getAdvertiserSeenAt() == null) {
                    unseen++;
                }
                if (lead.getCreatedAt() != null && !lead.getCreatedAt().isBefore(todayStart)) {
                    today++;
                }
                String s = lead.getAdvertiserStatus() == null ? AdvertiserLeadStatus.NEW : lead.getAdvertiserStatus();
                byStatus.merge(s, 1L, Long::sum);
            }
        }
        Map<String, Object> out = new HashMap<>();
        out.put("totalLeads", total);
        out.put("unseenLeads", unseen);
        out.put("todayLeads", today);
        out.put("byStatus", byStatus);
        return out;
    }

    // ---------- 리드 목록 / 상세 ----------

    /**
     * 리드 목록. 검색·상태·기간 필터는 마케터 목록과 동일하게 메모리에서 처리하고,
     * <b>페이지 크기는 서버가 상한을 강제</b>한다(대량 추출 방어).
     */
    @Transactional(readOnly = true)
    public AdvertiserLeadPage leads(Long advertiserId, Long formId, String status, String q,
            String from, String to, Integer page, Integer size) {
        requireGrant(advertiserId, formId);

        List<Lead> filtered = filterLeads(formId, status, q, from, to);
        // 정렬 불필요: 리포지토리가 createdAt DESC 로 주고, 필터링은 순서를 유지한다.
        int pageSize = size == null || size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);
        int pageIndex = page == null || page < 0 ? 0 : page;
        int start = Math.min(pageIndex * pageSize, filtered.size());
        int end = Math.min(start + pageSize, filtered.size());

        List<AdvertiserLeadResponse> items = filtered.subList(start, end).stream()
                .map(AdvertiserLeadResponse::from)
                .toList();
        return new AdvertiserLeadPage(items, filtered.size(), pageIndex, pageSize);
    }

    /**
     * 실시간 폴링(A6): {@code since} 이후 접수된 새 리드 수를 알려준다.
     * 프론트는 반환된 {@code serverTime} 을 다음 요청의 {@code since} 로 써서 시계 오차를 피한다.
     * {@code since} 가 없으면(최초 호출) 기준선만 잡고 0 을 돌려준다. 조회만 하므로 서버 부하가 작다.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> updates(Long advertiserId, Long formId, String since) {
        requireGrant(advertiserId, formId);
        Instant now = Instant.now();
        long newCount = 0;
        Instant sinceAt = parseInstant(since);
        if (sinceAt != null) {
            newCount = leadRepository.countByFormIdAndDeletedAtIsNullAndCreatedAtAfter(formId, sinceAt);
        }
        Map<String, Object> out = new HashMap<>();
        out.put("newCount", newCount);
        out.put("serverTime", now.toString());
        return out;
    }

    private static Instant parseInstant(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(s.trim());
        } catch (RuntimeException e) {
            return null;
        }
    }

    /**
     * 처리속도 리포트(A7): 기간 내 배정 리드의 응답성 지표.
     * 접수→최초열람 평균 · 접수→상태변경 평균 · 미확인율 · 상태 분포. 조회만 한다.
     */
    @Transactional(readOnly = true)
    public AdvertiserReportResponse report(Long advertiserId, Long formId, String from, String to) {
        AdvertiserFormGrant grant = requireGrant(advertiserId, formId);
        List<Lead> leads = filterLeads(formId, null, null, from, to);

        int total = leads.size();
        long seenSum = 0;
        int seenN = 0;
        long statusSum = 0;
        int statusN = 0;

        // 상태별 건수 — 6개 상태를 정의 순서대로 0 으로 초기화(빈 상태도 표에 보이게).
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (String code : AdvertiserLeadStatus.LABELS.keySet()) {
            counts.put(code, 0);
        }
        for (Lead l : leads) {
            String st = l.getAdvertiserStatus() == null ? AdvertiserLeadStatus.NEW : l.getAdvertiserStatus();
            counts.merge(st, 1, Integer::sum);
            Instant created = l.getCreatedAt();
            if (created != null && l.getAdvertiserSeenAt() != null) {
                seenSum += Math.max(0, Duration.between(created, l.getAdvertiserSeenAt()).getSeconds());
                seenN++;
            }
            if (created != null && l.getAdvertiserStatusAt() != null) {
                statusSum += Math.max(0, Duration.between(created, l.getAdvertiserStatusAt()).getSeconds());
                statusN++;
            }
        }
        int seen = seenN;
        int unseen = total - seen;
        double unseenRate = total == 0 ? 0 : (double) unseen / total;
        Long avgSeen = seenN > 0 ? seenSum / seenN : null;
        Long avgStatus = statusN > 0 ? statusSum / statusN : null;

        List<AdvertiserReportResponse.StatusCount> statusCounts = counts.entrySet().stream()
                .map(e -> new AdvertiserReportResponse.StatusCount(
                        e.getKey(), AdvertiserLeadStatus.label(e.getKey()), e.getValue()))
                .toList();

        String name = grant.getDisplayName() != null && !grant.getDisplayName().isBlank()
                ? grant.getDisplayName()
                : formRepository.findById(formId).map(Form::getName).orElse("리드폼");

        return new AdvertiserReportResponse(formId, name, from, to, total, seen, unseen, unseenRate,
                avgSeen, avgStatus, statusCounts);
    }

    /** 리드 상세. 최초 열람이면 {@code advertiser_seen_at} 을 남긴다(마케터 목록의 '확인' 표시 근거). */
    @Transactional
    public AdvertiserLeadResponse lead(Long advertiserId, Long leadId, String ip) {
        Lead lead = requireOwnedLead(advertiserId, leadId);
        boolean first = lead.markAdvertiserSeen(Instant.now());
        if (first) {
            audit.record(new AdvertiserAccessLog(advertiserId, emailOf(advertiserId),
                    AdvertiserAccessLog.ACTION_VIEW_LEAD, ip)
                    .target(lead.getFormId(), lead.getId(), "최초 열람"));
        }
        return AdvertiserLeadResponse.from(lead);
    }

    /** 광고주 상태 변경. 마케터의 status 는 건드리지 않는다. */
    @Transactional
    public AdvertiserLeadResponse updateStatus(Long advertiserId, Long leadId, String status, String ip) {
        if (!AdvertiserLeadStatus.isValid(status)) {
            throw new InvalidSubmissionException("상태 값이 올바르지 않습니다.");
        }
        Lead lead = requireOwnedLead(advertiserId, leadId);
        AdvertiserFormGrant grant = requireGrant(advertiserId, lead.getFormId());
        if (!grant.isCanStatus()) {
            throw new NotFoundException("상태를 변경할 권한이 없습니다.");
        }
        String before = lead.getAdvertiserStatus() == null ? AdvertiserLeadStatus.NEW : lead.getAdvertiserStatus();
        if (!status.equals(before)) {
            lead.changeAdvertiserStatus(status, Instant.now());
            // 상태 변경 이력은 양쪽(마케터·광고주)이 함께 봐야 하므로 visibility=ALL
            noteRepository.save(new LeadNote(leadId, advertiserId, LeadNote.KIND_SYSTEM,
                    "광고주 상태 변경: " + AdvertiserLeadStatus.label(before) + " → "
                            + AdvertiserLeadStatus.label(status),
                    LeadNote.VISIBILITY_ALL));
            audit.record(new AdvertiserAccessLog(advertiserId, emailOf(advertiserId),
                    AdvertiserAccessLog.ACTION_STATUS, ip)
                    .target(lead.getFormId(), leadId, before + " → " + status));
        }
        lead.markAdvertiserSeen(Instant.now());
        return AdvertiserLeadResponse.from(lead);
    }

    // ---------- 메모 ----------

    /** 광고주에게 공개된 메모/이력만(visibility=ALL). 마케터 내부 메모는 절대 포함하지 않는다. */
    @Transactional(readOnly = true)
    public List<AdvertiserNoteResponse> notes(Long advertiserId, Long leadId) {
        requireOwnedLead(advertiserId, leadId);
        return noteRepository.findByLeadIdOrderByCreatedAtAsc(leadId).stream()
                .filter(LeadNote::isSharedWithAdvertiser)
                .map(n -> AdvertiserNoteResponse.of(n, advertiserId))
                .toList();
    }

    @Transactional
    public AdvertiserNoteResponse addNote(Long advertiserId, Long leadId, String body, String ip) {
        Lead lead = requireOwnedLead(advertiserId, leadId);
        AdvertiserFormGrant grant = requireGrant(advertiserId, lead.getFormId());
        if (!grant.isCanMemo()) {
            throw new NotFoundException("메모를 작성할 권한이 없습니다.");
        }
        String text = body == null ? "" : body.trim();
        if (text.isEmpty()) {
            throw new InvalidSubmissionException("메모 내용을 입력해주세요.");
        }
        // 광고주 메모는 마케터도 볼 수 있어야 소통이 된다 → ALL
        LeadNote note = noteRepository.save(new LeadNote(leadId, advertiserId, LeadNote.KIND_MEMO, text,
                LeadNote.VISIBILITY_ALL));
        audit.record(new AdvertiserAccessLog(advertiserId, emailOf(advertiserId),
                AdvertiserAccessLog.ACTION_MEMO, ip).target(lead.getFormId(), leadId, null));
        return AdvertiserNoteResponse.of(note, advertiserId);
    }

    // ---------- 내부 ----------

    /** 리드 로드 + 그 리드폼에 대한 권한 확인. 권한 없으면 404. */
    private Lead requireOwnedLead(Long advertiserId, Long leadId) {
        Lead lead = leadRepository.findById(leadId)
                .filter(l -> l.getDeletedAt() == null)
                .orElseThrow(() -> new NotFoundException("리드를 찾을 수 없습니다."));
        requireGrant(advertiserId, lead.getFormId());
        return lead;
    }

    // ---------- 내보내기 (A4) ----------

    /**
     * 배정받은 리드를 엑셀/CSV 표(0행=헤더)로 만든다. 화면과 동일한 <b>화이트리스트 컬럼</b>만 담는다:
     * 접수일시 · 광고주 상태 · 답변 항목. <b>IP·UTM·기기 등 추적정보는 절대 넣지 않는다</b>.
     * 마지막 행에 워터마크(다운로드한 광고주 이메일·일시)를 붙이고 EXPORT 감사 로그를 남긴다.
     * <p>
     * 일일 횟수 상한을 초과하면 {@link PlanLimitExceededException}(유출 방어). 권한(can_export) 없으면 404.
     */
    @Transactional
    public List<List<String>> export(Long advertiserId, Long formId, String status, String q,
            String from, String to, String ip) {
        AdvertiserFormGrant grant = requireGrant(advertiserId, formId);
        if (!grant.isCanExport()) {
            throw new NotFoundException("내보낼 권한이 없습니다.");
        }
        enforceExportLimit(advertiserId);

        List<Lead> leads = filterLeads(formId, status, q, from, to);
        List<List<String>> matrix = buildExportMatrix(leads);

        String email = emailOf(advertiserId);
        // 워터마크: 유출 시 출처를 특정할 수 있게 파일 맨 아래에 남긴다.
        matrix.add(List.of("다운로드: " + nn(email) + " / " + DT.format(Instant.now())));

        audit.record(new AdvertiserAccessLog(advertiserId, email, AdvertiserAccessLog.ACTION_EXPORT, ip)
                .target(formId, null, leads.size() + "건 내보내기"));
        return matrix;
    }

    /** 오늘 이미 상한만큼 내보냈으면 거부. `advertiser_access_logs` 의 EXPORT 카운트로 판정(별도 테이블 불필요). */
    private void enforceExportLimit(Long advertiserId) {
        if (exportDailyMax <= 0) {
            return;
        }
        Instant since = LocalDate.now(KST).atStartOfDay(KST).toInstant();
        long today = accessLogRepository.countByAdvertiserIdAndActionAndCreatedAtAfter(
                advertiserId, AdvertiserAccessLog.ACTION_EXPORT, since);
        if (today >= exportDailyMax) {
            throw new PlanLimitExceededException(
                    "오늘 내보내기 횟수(" + exportDailyMax + "회)를 모두 사용했습니다. 내일 다시 시도해주세요.");
        }
    }

    /** 컬럼 = 접수일시·상태 + (리드들의 답변 라벨을 처음 등장 순서로). */
    private List<List<String>> buildExportMatrix(List<Lead> leads) {
        LinkedHashSet<String> answerCols = new LinkedHashSet<>();
        for (Lead l : leads) {
            if (l.getAnswers() != null) {
                for (Map<String, Object> a : l.getAnswers()) {
                    String label = str(a.get("label"));
                    if (!label.isBlank()) {
                        answerCols.add(label);
                    }
                }
            }
        }
        List<String> header = new ArrayList<>();
        header.add("접수일시");
        header.add("상태");
        header.addAll(answerCols);

        List<List<String>> matrix = new ArrayList<>();
        matrix.add(header);
        for (Lead l : leads) {
            Map<String, String> ans = new HashMap<>();
            if (l.getAnswers() != null) {
                for (Map<String, Object> a : l.getAnswers()) {
                    ans.put(str(a.get("label")), str(a.get("value")));
                }
            }
            List<String> row = new ArrayList<>(header.size());
            row.add(l.getCreatedAt() != null ? DT.format(l.getCreatedAt()) : "");
            String st = l.getAdvertiserStatus() == null ? AdvertiserLeadStatus.NEW : l.getAdvertiserStatus();
            row.add(AdvertiserLeadStatus.label(st));
            for (String c : answerCols) {
                row.add(ans.getOrDefault(c, ""));
            }
            matrix.add(row);
        }
        return matrix;
    }

    /** 목록·내보내기가 공유하는 필터(상태·검색어·기간). grant 검증은 호출자 책임. */
    private List<Lead> filterLeads(Long formId, String status, String q, String from, String to) {
        List<Lead> all = leadRepository.findByFormIdAndDeletedAtIsNullOrderByCreatedAtDesc(formId);
        List<Lead> filtered = new ArrayList<>();
        Instant fromAt = startOfDay(from);
        Instant toAt = endOfDay(to);
        String needle = q == null ? null : q.trim().toLowerCase();
        for (Lead lead : all) {
            String s = lead.getAdvertiserStatus() == null ? AdvertiserLeadStatus.NEW : lead.getAdvertiserStatus();
            if (status != null && !status.isBlank() && !status.equals(s)) {
                continue;
            }
            if (fromAt != null && lead.getCreatedAt() != null && lead.getCreatedAt().isBefore(fromAt)) {
                continue;
            }
            if (toAt != null && lead.getCreatedAt() != null && !lead.getCreatedAt().isBefore(toAt)) {
                continue;
            }
            if (needle != null && !needle.isEmpty() && !matches(lead, needle)) {
                continue;
            }
            filtered.add(lead);
        }
        return filtered;
    }

    private static String str(Object o) {
        return o == null ? "" : o.toString();
    }

    private static String nn(String s) {
        return s == null ? "" : s;
    }

    private String emailOf(Long advertiserId) {
        return userRepository.findById(advertiserId).map(User::getEmail).orElse(null);
    }

    private static boolean matches(Lead lead, String needle) {
        if (lead.getAnswers() == null) {
            return false;
        }
        for (Map<String, Object> answer : lead.getAnswers()) {
            Object label = answer.get("label");
            Object value = answer.get("value");
            if (label != null && label.toString().toLowerCase().contains(needle)) {
                return true;
            }
            if (value != null && value.toString().toLowerCase().contains(needle)) {
                return true;
            }
        }
        return false;
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
}
