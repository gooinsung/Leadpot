package com.leadpot.advertiser;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
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
import com.leadpot.sms.PhoneNumbers;

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
    /** 같은 리드를 이 시간 안에 다시 열면 열람 이력을 새로 남기지 않는다(새로고침 폭주 방지). */
    private static final java.time.Duration VIEW_DEDUPE_WINDOW = java.time.Duration.ofMinutes(30);
    private static final DateTimeFormatter DT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(KST);

    private final UserRepository userRepository;
    private final FormRepository formRepository;
    private final AdvertiserFormGrantRepository grantRepository;
    private final LeadRepository leadRepository;
    private final LeadNoteRepository noteRepository;
    private final AdvertiserAuditService audit;
    private final AdvertiserAccessLogRepository accessLogRepository;
    private final com.leadpot.lead.LeadStatusService leadStatusService;
    private final com.leadpot.lead.CustomLeadStatusRepository customStatusRepository;
    private final com.leadpot.lead.LeadAsRequestService asRequestService;
    /** 광고주 리드 내보내기 일일 횟수 상한(유출 방어). 0 이하면 무제한. */
    private final int exportDailyMax;

    public AdvertiserLeadService(UserRepository userRepository,
            FormRepository formRepository,
            AdvertiserFormGrantRepository grantRepository,
            LeadRepository leadRepository,
            LeadNoteRepository noteRepository,
            AdvertiserAuditService audit,
            AdvertiserAccessLogRepository accessLogRepository,
            com.leadpot.lead.LeadStatusService leadStatusService,
            com.leadpot.lead.CustomLeadStatusRepository customStatusRepository,
            com.leadpot.lead.LeadAsRequestService asRequestService,
            @Value("${app.advertiser.export-daily-max:20}") int exportDailyMax) {
        this.userRepository = userRepository;
        this.formRepository = formRepository;
        this.grantRepository = grantRepository;
        this.leadRepository = leadRepository;
        this.noteRepository = noteRepository;
        this.audit = audit;
        this.accessLogRepository = accessLogRepository;
        this.leadStatusService = leadStatusService;
        this.customStatusRepository = customStatusRepository;
        this.asRequestService = asRequestService;
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
                marketer.getBrandLogoUrl(), marketer.getBrandColor(), nn(advertiser.getNotifyPhone()));
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
            out.add(toFormResponse(grant, form, advertiser));
        }
        return out;
    }

    /**
     * 광고주 화면용 리드폼 항목 조립. 수신번호는 <b>폼 전용 → 계정 기본</b> 순으로 정해지므로
     * (V33) 화면이 그 판단을 다시 하지 않게 실제 발송 번호까지 계산해 내려준다.
     */
    private AdvertiserFormResponse toFormResponse(AdvertiserFormGrant grant, Form form, User advertiser) {
        List<Lead> leads = leadRepository.findByFormIdAndDeletedAtIsNullOrderByCreatedAtDesc(grant.getFormId());
        long unseen = leads.stream().filter(l -> l.getAdvertiserSeenAt() == null).count();
        String name = grant.getDisplayName() != null && !grant.getDisplayName().isBlank()
                ? grant.getDisplayName()
                : form.getName();
        return new AdvertiserFormResponse(form.getId(), name, leads.size(), unseen,
                grant.isCanStatus(), grant.isCanMemo(), grant.isCanExport(),
                notifyEnabled(form), nn(grant.getNotifyPhone()), grant.isNotifyDisabled(),
                nn(grant.resolveNotifyPhone(advertiser.getNotifyPhone())));
    }

    /** 마케터가 이 리드폼의 광고주 접수 알림을 켰는지. */
    private boolean notifyEnabled(Form form) {
        Map<String, Object> cfg = form.getSettingsConfig();
        return cfg != null && Boolean.TRUE.equals(cfg.get("smsAdvertiserEnabled"));
    }

    /**
     * 광고주가 <b>자기</b> 접수 알림 수신번호를 등록·변경·삭제한다(V28).
     *
     * <p>마케터는 이 번호를 넣을 수 없다 — 광고주 본인이 넣는 행위가 수신 동의 근거이기 때문이다
     * (docs/MESSAGING-PLAN.md §9). 빈 값을 보내면 지워지고 발송이 멈춘다.
     *
     * <p>권한(grant)이 있는 리드폼에만 쓸 수 있다. 남의 리드폼 번호를 건드리려 하면 404 다.
     *
     * @param phone 사용자가 입력한 원본 번호(하이픈 허용). 형식이 아니면 400.
     */
    @Transactional
    public AdvertiserFormResponse updateNotifyPhone(Long advertiserId, Long formId, String phone) {
        User advertiser = loadActiveAdvertiser(advertiserId);
        AdvertiserFormGrant grant = grantRepository.findByFormId(formId)
                .filter(g -> g.getAdvertiserId().equals(advertiserId))
                .filter(g -> g.isEffective(Instant.now()))
                .orElseThrow(() -> new NotFoundException("권한이 없는 리드폼입니다."));
        Form form = formRepository.findByIdAndOwnerId(formId, advertiser.getParentUserId())
                .orElseThrow(() -> new NotFoundException("리드폼을 찾을 수 없습니다."));

        String raw = phone == null ? "" : phone.trim();
        if (raw.isBlank()) {
            grant.setNotifyPhone(null, null);
        } else {
            String normalized = PhoneNumbers.normalize(raw);
            if (normalized == null) {
                throw new InvalidSubmissionException("연락처 형식이 올바르지 않습니다.");
            }
            grant.setNotifyPhone(normalized, Instant.now());
        }
        grantRepository.save(grant);
        return toFormResponse(grant, form, advertiser);
    }

    /**
     * 광고주가 <b>계정 기본</b> 수신번호를 등록·변경·삭제한다(V33).
     * 배정된 모든 리드폼에 적용되고, 폼 전용 번호가 지정된 폼만 그 값이 우선한다.
     *
     * <p>V28 원칙은 그대로다 — 넣는 사람은 <b>광고주 본인</b>이고, 그 행위가 수신 동의 근거다.
     * 가입 연락처({@code users.phone})로 폴백하지 않는다: 그건 계정 식별용이고 동의가 아니다.
     *
     * @param phone 사용자가 입력한 원본 번호(하이픈 허용). 빈 값이면 지운다. 형식이 아니면 400.
     */
    @Transactional
    public String updateDefaultNotifyPhone(Long advertiserId, String phone) {
        User advertiser = loadActiveAdvertiser(advertiserId);
        String raw = phone == null ? "" : phone.trim();
        if (raw.isBlank()) {
            advertiser.setNotifyPhone(null, null);
        } else {
            String normalized = PhoneNumbers.normalize(raw);
            if (normalized == null) {
                throw new InvalidSubmissionException("연락처 형식이 올바르지 않습니다.");
            }
            advertiser.setNotifyPhone(normalized, Instant.now());
        }
        userRepository.save(advertiser);
        return nn(advertiser.getNotifyPhone());
    }

    /**
     * 광고주가 <b>이 리드폼만</b> 알림을 끄거나 다시 켠다(V33).
     *
     * <p>계정 기본 번호가 생기면서 "번호를 비우면 중단"이 성립하지 않게 됐다 — 비우면 기본값으로 나간다.
     * 그래서 끄는 뜻을 별도 상태로 저장한다. 수신 거부는 즉시 반영돼야 하는 권리라 별도 확인을 두지 않는다.
     */
    @Transactional
    public AdvertiserFormResponse updateNotifyDisabled(Long advertiserId, Long formId, boolean disabled) {
        User advertiser = loadActiveAdvertiser(advertiserId);
        AdvertiserFormGrant grant = grantRepository.findByFormId(formId)
                .filter(g -> g.getAdvertiserId().equals(advertiserId))
                .filter(g -> g.isEffective(Instant.now()))
                .orElseThrow(() -> new NotFoundException("권한이 없는 리드폼입니다."));
        Form form = formRepository.findByIdAndOwnerId(formId, advertiser.getParentUserId())
                .orElseThrow(() -> new NotFoundException("리드폼을 찾을 수 없습니다."));
        grant.setNotifyDisabled(disabled);
        grantRepository.save(grant);
        return toFormResponse(grant, form, advertiser);
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
        // 키 = statusKey(고정 코드 | C{id}) — 통합 축(V29). 고정 4개는 빈 상태도 보이게 0 으로 깐다.
        Map<String, Long> byStatus = new HashMap<>();
        for (String s : com.leadpot.lead.LeadStatuses.FIXED_LABELS.keySet()) {
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
                byStatus.merge(lead.statusKey(), 1L, Long::sum);
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
                .map(this::toResponse)
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
        String name = grant.getDisplayName() != null && !grant.getDisplayName().isBlank()
                ? grant.getDisplayName()
                : formRepository.findById(formId).map(Form::getName).orElse("리드폼");
        return AdvertiserReportResponse.from(leads, formId, name, from, to, customNames(advertiserId));
    }

    /** 이 광고주의 커스텀 상태 id → 이름(보관 포함 — 리포트는 과거 리드도 그린다). */
    private Map<Long, String> customNames(Long advertiserId) {
        Map<Long, String> out = new HashMap<>();
        for (com.leadpot.lead.CustomLeadStatus s
                : customStatusRepository.findByAdvertiserIdOrderBySortOrderAscIdAsc(advertiserId)) {
            out.put(s.getId(), s.getName());
        }
        return out;
    }

    /**
     * 리드 상세. 최초 열람이면 {@code advertiser_seen_at} 을 남기고, <b>열람 이력은 매번</b> 남긴다(V33).
     * <p>
     * 예전엔 최초 1회만 기록했다. 그러면 마케터가 "봤다/안 봤다" 한 비트밖에 볼 수 없어서
     * <b>언제·몇 번 봤는지</b>를 알 수 없었다 — 리드 상세의 '광고주' 타임라인이 이 이력을 쓴다.
     * 새로고침·연속 클릭으로 같은 줄이 쌓이지 않게 {@link #VIEW_DEDUPE_WINDOW} 안의 재열람은 접는다.
     */
    @Transactional
    public AdvertiserLeadResponse lead(Long advertiserId, Long leadId, String ip) {
        Lead lead = requireOwnedLead(advertiserId, leadId);
        Instant now = Instant.now();
        boolean first = lead.markAdvertiserSeen(now);
        if (first || !viewedRecently(advertiserId, leadId, now)) {
            audit.record(new AdvertiserAccessLog(advertiserId, emailOf(advertiserId),
                    AdvertiserAccessLog.ACTION_VIEW_LEAD, ip)
                    .target(lead.getFormId(), lead.getId(), first ? "최초 열람" : "다시 열람"));
        }
        return toResponse(lead);
    }

    /** 방금 전(윈도 안) 같은 리드를 이미 열어봤는지. 감사 로그가 없어도 본래 동작은 막지 않는다. */
    private boolean viewedRecently(Long advertiserId, Long leadId, Instant now) {
        try {
            return accessLogRepository.existsByAdvertiserIdAndLeadIdAndActionAndCreatedAtAfter(
                    advertiserId, leadId, AdvertiserAccessLog.ACTION_VIEW_LEAD, now.minus(VIEW_DEDUPE_WINDOW));
        } catch (RuntimeException e) {
            return false; // 판정 실패 시엔 기록하는 쪽으로(누락보다 중복이 낫다)
        }
    }

    /**
     * 리드 상세 <b>읽기 전용</b> — 마케터 미리보기(impersonate) 전용.
     * {@link #lead}과 달리 <b>열람 시각(seen)·VIEW_LEAD 로그를 남기지 않는다</b>.
     * 마케터가 들여다본 것을 광고주가 확인한 것처럼 기록하면 §5 분쟁 방어의 증거가 오염되기 때문이다.
     */
    @Transactional(readOnly = true)
    public AdvertiserLeadResponse leadReadOnly(Long advertiserId, Long leadId) {
        return toResponse(requireOwnedLead(advertiserId, leadId));
    }

    /** 응답 변환 — 커스텀 상태면 정의 이름을 함께 실어준다. */
    private AdvertiserLeadResponse toResponse(Lead lead) {
        return AdvertiserLeadResponse.from(lead, customNameOf(lead));
    }

    /** 리드의 커스텀 상태 이름(없으면 null). */
    private String customNameOf(Lead lead) {
        if (lead.getCustomStatusId() == null) {
            return null;
        }
        return customStatusRepository.findById(lead.getCustomStatusId())
                .map(com.leadpot.lead.CustomLeadStatus::getName).orElse(null);
    }

    /**
     * 광고주 상태 변경 — 통합 축(V29). 규칙(무효·AS요청 불가, 무효 리드 잠금)·이력·과금은
     * {@link com.leadpot.lead.LeadStatusService} 가 처리한다. 유효로 넘기면 그대로 과금 확정이다.
     */
    @Transactional
    public AdvertiserLeadResponse updateStatus(Long advertiserId, Long leadId, String status,
            Long customStatusId, String ip) {
        Lead lead = requireOwnedLead(advertiserId, leadId);
        AdvertiserFormGrant grant = requireGrant(advertiserId, lead.getFormId());
        if (!grant.isCanStatus()) {
            throw new NotFoundException("상태를 변경할 권한이 없습니다.");
        }
        String before = lead.statusKey();
        leadStatusService.changeByAdvertiser(advertiserId, lead, status, customStatusId);
        if (!before.equals(lead.statusKey())) {
            audit.record(new AdvertiserAccessLog(advertiserId, emailOf(advertiserId),
                    AdvertiserAccessLog.ACTION_STATUS, ip)
                    .target(lead.getFormId(), leadId, before + " → " + lead.statusKey()));
        }
        lead.markAdvertiserSeen(Instant.now());
        return toResponse(lead);
    }

    // ---------- AS 요청(V30) ----------

    /**
     * AS 접수(광고주). 상태 변경 권한(canStatus)이 있어야 한다 — 상태 축을 움직이는 행위라서다.
     * 접수되면 리드가 AS_REQUESTED 로 잠기고 마케터에게 알림이 간다.
     */
    @Transactional
    public com.leadpot.lead.dto.LeadAsRequestResponse requestAs(Long advertiserId, Long leadId,
            String reason, java.util.List<String> evidenceUrls, String ip) {
        Lead lead = requireOwnedLead(advertiserId, leadId);
        AdvertiserFormGrant grant = requireGrant(advertiserId, lead.getFormId());
        if (!grant.isCanStatus()) {
            throw new NotFoundException("AS 요청 권한이 없습니다.");
        }
        com.leadpot.lead.dto.LeadAsRequestResponse res =
                asRequestService.request(advertiserId, lead, reason, evidenceUrls);
        audit.record(new AdvertiserAccessLog(advertiserId, emailOf(advertiserId),
                AdvertiserAccessLog.ACTION_STATUS, ip).target(lead.getFormId(), leadId, "AS 요청"));
        return res;
    }

    /** 이 리드의 AS 이력(광고주 화면). */
    @Transactional(readOnly = true)
    public java.util.List<com.leadpot.lead.dto.LeadAsRequestResponse> asHistory(Long advertiserId, Long leadId) {
        requireOwnedLead(advertiserId, leadId);
        return asRequestService.history(leadId);
    }

    // ---------- 메모 ----------

    /** 광고주에게 공개된 메모/이력만(visibility=ALL). 마케터 내부 메모는 절대 포함하지 않는다. */
    @Transactional(readOnly = true)
    public List<AdvertiserNoteResponse> notes(Long advertiserId, Long leadId) {
        requireOwnedLead(advertiserId, leadId);
        List<LeadNote> shared = noteRepository.findByLeadIdOrderByCreatedAtAsc(leadId).stream()
                .filter(LeadNote::isSharedWithAdvertiser)
                .toList();
        Map<Long, String> roles = authorRoles(shared);
        return shared.stream()
                .map(n -> AdvertiserNoteResponse.of(n, advertiserId,
                        n.getOwnerId() == null ? null : roles.get(n.getOwnerId())))
                .toList();
    }

    /** 작성자 id → 역할(MARKETER/ADVERTISER) 일괄 조회 — 메모마다 왕복하지 않는다(DB 가 원격). */
    private Map<Long, String> authorRoles(List<LeadNote> notes) {
        java.util.Set<Long> ids = new java.util.HashSet<>();
        for (LeadNote n : notes) {
            if (n.getOwnerId() != null) {
                ids.add(n.getOwnerId());
            }
        }
        Map<Long, String> out = new HashMap<>();
        if (!ids.isEmpty()) {
            userRepository.findAllById(ids).forEach(u ->
                    out.put(u.getId(), u.getRole() == Role.ADVERTISER ? "ADVERTISER" : "MARKETER"));
        }
        return out;
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
        return AdvertiserNoteResponse.of(note, advertiserId, "ADVERTISER");
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
            row.add(com.leadpot.lead.LeadStatuses.label(l.getStatus(), customNameOf(l)));
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
            // 필터 키: 고정 상태는 코드, 커스텀은 C{id} (통합 축 V29)
            if (status != null && !status.isBlank() && !status.equals(lead.statusKey())) {
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
