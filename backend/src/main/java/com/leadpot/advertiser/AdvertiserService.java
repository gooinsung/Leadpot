package com.leadpot.advertiser;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.advertiser.dto.AdvertiserLeadPage;
import com.leadpot.advertiser.dto.AdvertiserLogResponse;
import com.leadpot.advertiser.dto.AdvertiserNotifyStatus;
import com.leadpot.advertiser.dto.AdvertiserPreviewLead;
import com.leadpot.advertiser.dto.AdvertiserPreviewResponse;
import com.leadpot.advertiser.dto.AdvertiserReportResponse;
import com.leadpot.advertiser.dto.AdvertiserSummary;
import com.leadpot.advertiser.dto.BrandSettings;
import com.leadpot.advertiser.dto.AdvertiserUpdateRequest;
import com.leadpot.advertiser.dto.GrantUpdateRequest;
import com.leadpot.advertiser.dto.GrantView;
import com.leadpot.auth.Plan;
import com.leadpot.auth.Role;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.ConflictException;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.common.error.PlanLimitExceededException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadAsRequest;
import com.leadpot.lead.LeadAsRequestRepository;
import com.leadpot.lead.LeadNoteRepository;
import com.leadpot.lead.LeadRepository;
import com.leadpot.sms.PhoneNumbers;

/**
 * 마케터가 자기 광고주 하위계정을 관리하는 서비스.
 * <p>
 * <b>모든 조회·수정은 "이 광고주가 내 광고주인가"({@code parent_user_id})를 먼저 확인한다.</b>
 * 남의 광고주는 존재 자체를 숨기기 위해 404 로 응답한다.
 */
@Service
public class AdvertiserService {

    private final UserRepository userRepository;
    private final FormRepository formRepository;
    private final AdvertiserFormGrantRepository grantRepository;
    private final AdvertiserAccessLogRepository logRepository;
    private final AdvertiserInviteRepository inviteRepository;
    private final LeadRepository leadRepository;
    private final LeadNoteRepository noteRepository;
    private final AdvertiserLeadService leadService;
    private final AdvertiserAuditService audit;
    private final com.leadpot.lead.CustomLeadStatusRepository customStatusRepository;
    private final LeadAsRequestRepository asRequestRepository;
    private final int maxFree;
    private final int maxPro;

    public AdvertiserService(UserRepository userRepository,
            FormRepository formRepository,
            AdvertiserFormGrantRepository grantRepository,
            AdvertiserAccessLogRepository logRepository,
            AdvertiserInviteRepository inviteRepository,
            LeadRepository leadRepository,
            LeadNoteRepository noteRepository,
            AdvertiserLeadService leadService,
            AdvertiserAuditService audit,
            com.leadpot.lead.CustomLeadStatusRepository customStatusRepository,
            LeadAsRequestRepository asRequestRepository,
            @Value("${app.advertiser.max-free}") int maxFree,
            @Value("${app.advertiser.max-pro}") int maxPro) {
        this.userRepository = userRepository;
        this.formRepository = formRepository;
        this.grantRepository = grantRepository;
        this.logRepository = logRepository;
        this.inviteRepository = inviteRepository;
        this.leadRepository = leadRepository;
        this.noteRepository = noteRepository;
        this.leadService = leadService;
        this.audit = audit;
        this.customStatusRepository = customStatusRepository;
        this.asRequestRepository = asRequestRepository;
        this.maxFree = maxFree;
        this.maxPro = maxPro;
    }

    // ---------- 광고주 계정 ----------

    @Transactional(readOnly = true)
    public List<AdvertiserSummary> list(Long marketerId) {
        List<User> advertisers =
                userRepository.findByParentUserIdAndRoleOrderByCreatedAtDesc(marketerId, Role.ADVERTISER);
        List<AdvertiserSummary> out = new ArrayList<>(advertisers.size());
        for (User a : advertisers) {
            out.add(new AdvertiserSummary(
                    a.getId(), a.getEmail(), a.getName(), a.getCompany(), a.getMemo(), a.isActive(),
                    grantRepository.countByAdvertiserId(a.getId()),
                    logRepository.findLastLoginAt(a.getId()),
                    a.getCreatedAt()));
        }
        return out;
    }

    /** 내 광고주 로드(아니면 404 — 존재 노출 방지). */
    @Transactional(readOnly = true)
    public User requireOwned(Long marketerId, Long advertiserId) {
        return loadOwned(marketerId, advertiserId);
    }

    // ---------- 화이트라벨(마케터 브랜드) ----------

    /** 내 브랜드(로고·색상) 조회. 광고주 화면 상단에 이 값이 표시된다. */
    @Transactional(readOnly = true)
    public BrandSettings getBrand(Long marketerId) {
        return BrandSettings.from(loadMarketer(marketerId));
    }

    /** 내 브랜드 저장. 색상은 #RGB/#RRGGBB 형식만 허용, 빈 값이면 해제(기본 브랜드로 되돌림). */
    @Transactional
    public BrandSettings updateBrand(Long marketerId, BrandSettings req) {
        User marketer = loadMarketer(marketerId);
        String logo = blankToNull(req.logoUrl());
        if (logo != null && logo.length() > 500) {
            throw new InvalidSubmissionException("로고 URL이 너무 깁니다.");
        }
        String color = blankToNull(req.color());
        if (color != null && !color.matches("^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$")) {
            throw new InvalidSubmissionException("색상은 #RRGGBB 형식이어야 합니다. (예: #4f46e5)");
        }
        marketer.setBrandLogoUrl(logo);
        marketer.setBrandColor(color);
        return BrandSettings.from(marketer);
    }

    private User loadMarketer(Long marketerId) {
        return userRepository.findById(marketerId)
                .filter(u -> u.getRole() != Role.ADVERTISER)
                .orElseThrow(() -> new NotFoundException("계정을 찾을 수 없습니다."));
    }

    // ---------- 처리속도 리포트(A7, 마케터 관점) ----------

    /**
     * 내 광고주의 처리속도 리포트 — 그 광고주에게 부여된 <b>모든 유효 리드폼의 리드를 합산</b>한다.
     * 광고주 자기 리포트(폼 1개)와 같은 지표를 쓰되 범위만 넓힌다(광고주 실적 비교용).
     */
    @Transactional(readOnly = true)
    public AdvertiserReportResponse responseTimeReport(Long marketerId, Long advertiserId, String from, String to) {
        User adv = loadOwned(marketerId, advertiserId);
        Instant fromAt = startOfDay(from);
        Instant toAt = endOfDay(to);

        List<Lead> leads = new ArrayList<>();
        Instant now = Instant.now();
        for (AdvertiserFormGrant grant : grantRepository.findByAdvertiserId(advertiserId)) {
            if (!grant.isEffective(now)) {
                continue;
            }
            // 폼이 실제로 내 것인지 재확인(방어).
            if (formRepository.findByIdAndOwnerId(grant.getFormId(), marketerId).isEmpty()) {
                continue;
            }
            for (Lead lead : leadRepository.findByFormIdAndDeletedAtIsNullOrderByCreatedAtDesc(grant.getFormId())) {
                if (fromAt != null && lead.getCreatedAt() != null && lead.getCreatedAt().isBefore(fromAt)) {
                    continue;
                }
                if (toAt != null && lead.getCreatedAt() != null && !lead.getCreatedAt().isBefore(toAt)) {
                    continue;
                }
                leads.add(lead);
            }
        }
        String name = adv.getCompany() != null && !adv.getCompany().isBlank() ? adv.getCompany() : adv.getName();
        Map<Long, String> customNames = new HashMap<>();
        for (com.leadpot.lead.CustomLeadStatus s
                : customStatusRepository.findByAdvertiserIdOrderBySortOrderAscIdAsc(advertiserId)) {
            customNames.put(s.getId(), s.getName());
        }
        List<LeadAsRequest> asRequests = leads.isEmpty()
                ? List.of()
                : asRequestRepository.findByLeadIdIn(leads.stream().map(Lead::getId).toList());
        return AdvertiserReportResponse.from(leads, asRequests, null, name, from, to, customNames);
    }

    // ---------- 광고주 화면 미리보기(A7, impersonate·읽기 전용) ----------
    //
    // ⛔ 여기에는 조회 메서드만 둔다. 상태변경·메모·내보내기 같은 쓰기는 <b>엔드포인트 자체를 만들지 않는다</b>.
    //    마케터가 광고주인 척 데이터를 바꾸면 감사 로그가 오염돼 §5 분쟁 방어의 증거 가치가 사라진다.
    //    리드 상세도 seen 을 남기지 않는 leadReadOnly 를 쓴다. 진입·이탈은 IMPERSONATE 로 남긴다.

    /** 미리보기 진입: 폼 목록·대시보드(광고주가 보는 것과 동일). 진입을 IMPERSONATE 로 기록. */
    @Transactional
    public AdvertiserPreviewResponse previewEnter(Long marketerId, Long advertiserId, String ip) {
        User adv = loadOwned(marketerId, advertiserId);
        logImpersonate(adv, ip, "미리보기 진입 (마케터 " + marketerId + ")");
        return new AdvertiserPreviewResponse(adv.getId(), adv.getName(), adv.getCompany(),
                leadService.forms(advertiserId), leadService.dashboard(advertiserId));
    }

    /** 미리보기 리드 목록(읽기 전용). 광고주 목록과 동일한 필터·페이징. */
    @Transactional(readOnly = true)
    public AdvertiserLeadPage previewLeads(Long marketerId, Long advertiserId, Long formId,
            String status, String q, String from, String to, Integer page, Integer size) {
        loadOwned(marketerId, advertiserId);
        return leadService.leads(advertiserId, formId, status, q, from, to, page, size);
    }

    /** 미리보기 리드 상세(읽기 전용) + 공유 메모. seen 을 남기지 않는다. */
    @Transactional(readOnly = true)
    public AdvertiserPreviewLead previewLead(Long marketerId, Long advertiserId, Long leadId) {
        loadOwned(marketerId, advertiserId);
        return new AdvertiserPreviewLead(
                leadService.leadReadOnly(advertiserId, leadId),
                leadService.notes(advertiserId, leadId));
    }

    /** 미리보기 이탈 기록(프론트가 화면을 나갈 때 best-effort 호출). */
    @Transactional
    public void previewExit(Long marketerId, Long advertiserId, String ip) {
        User adv = loadOwned(marketerId, advertiserId);
        logImpersonate(adv, ip, "미리보기 종료 (마케터 " + marketerId + ")");
    }

    private void logImpersonate(User advertiser, String ip, String detail) {
        audit.record(new AdvertiserAccessLog(advertiser.getId(), advertiser.getEmail(),
                AdvertiserAccessLog.ACTION_IMPERSONATE, ip).target(null, null, detail));
    }

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

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

    /** 내 광고주의 활동 이력(최신순, 상한 200). 열람·상태변경·메모·내보내기·로그인 기록. */
    @Transactional(readOnly = true)
    public List<AdvertiserLogResponse> logs(Long marketerId, Long advertiserId, Integer limit) {
        loadOwned(marketerId, advertiserId); // 내 광고주가 아니면 404
        int size = limit == null || limit <= 0 ? 100 : Math.min(limit, 200);
        return logRepository
                .findByAdvertiserIdOrderByCreatedAtDesc(advertiserId, org.springframework.data.domain.PageRequest.of(0, size))
                .stream().map(AdvertiserLogResponse::from).toList();
    }

    @Transactional
    public AdvertiserSummary update(Long marketerId, Long advertiserId, AdvertiserUpdateRequest req) {
        User a = loadOwned(marketerId, advertiserId);
        if (req.name() != null && !req.name().isBlank()) {
            a.setName(req.name().trim());
        }
        a.setCompany(blankToNull(req.company()));
        a.setMemo(blankToNull(req.memo()));
        return new AdvertiserSummary(a.getId(), a.getEmail(), a.getName(), a.getCompany(), a.getMemo(),
                a.isActive(), grantRepository.countByAdvertiserId(a.getId()),
                logRepository.findLastLoginAt(a.getId()), a.getCreatedAt());
    }

    /** 정지/해제. 정지하면 로그인·토큰 재발급이 즉시 막힌다(AuthService 에서 active 확인). */
    @Transactional
    public void setActive(Long marketerId, Long advertiserId, boolean active) {
        loadOwned(marketerId, advertiserId).setActive(active);
    }

    /**
     * 광고주 삭제. 권한(grants)은 FK cascade 로 함께 지워지고,
     * <b>감사 로그는 FK 가 없어 그대로 남는다</b>(의도된 동작 — 이력 보존).
     *
     * <p><b>⚠️ 리드 메모/이력은 지우지 않고 작성자만 비운다</b>(사용자 결정 2026-08-06).
     * 광고주가 남긴 상담 메모와 상태변경 이력은 마케터의 리드 이력이라 함께 지우면 정보가 사라진다.
     * 화면에는 '삭제된 광고주'로 표시된다.
     *
     * <p><b>이 한 줄이 없으면 500 이 난다.</b> {@code lead_notes.owner_id} 가 {@code users(id)} 를
     * 참조하므로, 메모를 한 번이라도 남긴 광고주는 삭제가 FK 위반으로 막힌다(2026-08-06 실제 발생).
     * DB 쪽도 {@code on delete set null} 로 바꿔 안전망을 뒀지만(V27), 삭제 순서를 코드에 남긴다.
     */
    @Transactional
    public void delete(Long marketerId, Long advertiserId) {
        User a = loadOwned(marketerId, advertiserId);
        grantRepository.deleteByAdvertiserId(a.getId());
        noteRepository.clearOwner(a.getId());
        userRepository.delete(a);
    }

    // ---------- 플랜 상한 ----------

    /**
     * 광고주를 1명 더 늘릴 수 있는지 검사. 대기 중인 초대도 자리로 계산한다
     * (초대만 잔뜩 뿌려서 상한을 우회하지 못하게).
     */
    @Transactional(readOnly = true)
    public void checkCanAddAdvertiser(User marketer) {
        int max = maxFor(marketer.getPlan());
        if (max <= 0) {
            return; // 0 = 무제한
        }
        long current = userRepository.countByParentUserIdAndRole(marketer.getId(), Role.ADVERTISER);
        long pending = inviteRepository.findByMarketerIdAndAcceptedAtIsNull(marketer.getId()).stream()
                .filter(i -> i.isUsable(Instant.now()))
                .count();
        if (current + pending >= max) {
            throw new PlanLimitExceededException(
                    "현재 요금제(" + marketer.getPlan() + ")에서 만들 수 있는 광고주 계정은 " + max + "개입니다."
                            + " (사용 중 " + current + "명, 초대 대기 " + pending + "건)");
        }
    }

    private int maxFor(Plan plan) {
        return plan == Plan.PRO ? maxPro : maxFree;
    }

    // ---------- 리드폼 권한(grant) ----------

    /**
     * 권한 부여 화면 데이터: 마케터의 모든 리드폼 + 이 광고주에게 부여됐는지 + 다른 광고주가 선점했는지.
     */
    @Transactional(readOnly = true)
    public List<GrantView> grantViews(Long marketerId, Long advertiserId) {
        loadOwned(marketerId, advertiserId);
        List<Form> forms = formRepository.findByOwnerIdOrderByUpdatedAtDesc(marketerId);
        if (forms.isEmpty()) {
            return List.of();
        }
        List<Long> formIds = forms.stream().map(Form::getId).toList();

        // 이 폼들에 걸린 모든 권한(내 광고주 + 다른 광고주). form_id 는 UNIQUE 라 폼당 최대 1건.
        Map<Long, AdvertiserFormGrant> byForm = new HashMap<>();
        for (AdvertiserFormGrant g : grantRepository.findByFormIdIn(formIds)) {
            byForm.put(g.getFormId(), g);
        }
        // 선점자 표시용 이름 캐시
        Map<Long, String> holderNames = new HashMap<>();

        List<GrantView> out = new ArrayList<>(forms.size());
        for (Form form : forms) {
            AdvertiserFormGrant g = byForm.get(form.getId());
            boolean mine = g != null && g.getAdvertiserId().equals(advertiserId);
            String takenBy = null;
            if (g != null && !mine) {
                takenBy = holderNames.computeIfAbsent(g.getAdvertiserId(), id -> userRepository.findById(id)
                        .map(u -> u.getCompany() != null && !u.getCompany().isBlank() ? u.getCompany() : u.getName())
                        .orElse("다른 광고주"));
            }
            out.add(new GrantView(
                    form.getId(), form.getName(), mine,
                    mine ? g.getDisplayName() : null,
                    mine ? g.getExpiresAt() : null,
                    mine ? g.isCanStatus() : true,
                    mine ? g.isCanMemo() : true,
                    mine ? g.isCanExport() : true,
                    takenBy));
        }
        return out;
    }

    /**
     * 리드폼 하나의 광고주 접수 알림 수신 상태(V28). 리드폼 편집 화면 안내용.
     *
     * <p>마케터가 광고주 번호를 대신 넣던 칸을 없앤 대신, "지금 발송 가능한 상태인지"를 여기서 알려준다.
     * 번호 원본은 내려주지 않는다 — 마스킹만.
     *
     * @throws NotFoundException 내 리드폼이 아니면
     */
    @Transactional(readOnly = true)
    public AdvertiserNotifyStatus notifyStatus(Long marketerId, Long formId) {
        formRepository.findByIdAndOwnerId(formId, marketerId)
                .orElseThrow(() -> new NotFoundException("리드폼을 찾을 수 없습니다."));
        AdvertiserFormGrant grant = grantRepository.findByFormId(formId)
                .filter(g -> g.isEffective(Instant.now()))
                .orElse(null);
        if (grant == null) {
            return AdvertiserNotifyStatus.notLinked();
        }
        User advertiser = userRepository.findById(grant.getAdvertiserId()).orElse(null);
        String name = advertiser == null ? "광고주"
                : (advertiser.getCompany() != null && !advertiser.getCompany().isBlank()
                        ? advertiser.getCompany()
                        : advertiser.getName());
        // 실제 발송 번호는 폼 전용 → 계정 기본 순으로 정해진다(V33). 마케터에게도 그 결과를 보여줘야
        // "왜 안 왔지"를 추적할 수 있다 — 출처를 함께 내려 어떤 조치가 필요한지 구분되게 한다.
        String effective = grant.resolveNotifyPhone(advertiser == null ? null : advertiser.getNotifyPhone());
        String source = effective == null ? AdvertiserNotifyStatus.SOURCE_NONE
                : grant.hasNotifyPhone() ? AdvertiserNotifyStatus.SOURCE_FORM
                        : AdvertiserNotifyStatus.SOURCE_ACCOUNT;
        return new AdvertiserNotifyStatus(true, name, effective != null,
                effective == null ? null : PhoneNumbers.mask(effective),
                source, grant.isNotifyDisabled());
    }

    /**
     * 권한 일괄 교체. 요청 목록에 없는 리드폼의 권한은 회수한다.
     * <ul>
     * <li>내 리드폼이 아니면 404 (남의 폼을 내 광고주에게 줄 수 없다)</li>
     * <li>이미 <b>다른</b> 광고주에게 부여된 폼이면 409 (1리드폼:1광고주)</li>
     * </ul>
     */
    @Transactional
    public List<GrantView> replaceGrants(Long marketerId, Long advertiserId, GrantUpdateRequest req) {
        loadOwned(marketerId, advertiserId);

        // 요청된 폼이 전부 내 소유인지 먼저 검증(중복 formId 는 마지막 값으로 정리)
        Map<Long, GrantUpdateRequest.Item> requested = new LinkedHashMap<>();
        for (GrantUpdateRequest.Item item : req.items()) {
            if (item.formId() == null) {
                continue;
            }
            formRepository.findByIdAndOwnerId(item.formId(), marketerId)
                    .orElseThrow(() -> new NotFoundException("리드폼을 찾을 수 없습니다. (id=" + item.formId() + ")"));
            requested.put(item.formId(), item);
        }

        List<AdvertiserFormGrant> existing = grantRepository.findByAdvertiserId(advertiserId);
        Map<Long, AdvertiserFormGrant> existingByForm = new HashMap<>();
        for (AdvertiserFormGrant g : existing) {
            existingByForm.put(g.getFormId(), g);
        }

        // 회수: 기존에 있었지만 이번 요청에 없는 것
        Set<Long> toRevoke = new HashSet<>(existingByForm.keySet());
        toRevoke.removeAll(requested.keySet());
        for (Long formId : toRevoke) {
            grantRepository.delete(existingByForm.get(formId));
        }

        // 부여/수정
        for (Map.Entry<Long, GrantUpdateRequest.Item> e : requested.entrySet()) {
            Long formId = e.getKey();
            GrantUpdateRequest.Item item = e.getValue();
            AdvertiserFormGrant grant = existingByForm.get(formId);
            if (grant == null) {
                // 다른 광고주가 이미 선점했는지 확인(DB UNIQUE 도 있지만 친절한 메시지를 위해 먼저 검사)
                AdvertiserFormGrant taken = grantRepository.findByFormId(formId).orElse(null);
                if (taken != null && !taken.getAdvertiserId().equals(advertiserId)) {
                    String name = userRepository.findById(taken.getAdvertiserId())
                            .map(User::getEmail).orElse("다른 광고주");
                    throw new ConflictException(
                            "이 리드폼은 이미 다른 광고주(" + name + ")에게 부여되어 있습니다."
                                    + " 리드폼 하나에는 광고주 한 명만 연결할 수 있습니다.");
                }
                grant = grantRepository.save(new AdvertiserFormGrant(advertiserId, formId));
            }
            grant.apply(blankToNull(item.displayName()), item.expiresAt(),
                    item.statusAllowed(), item.memoAllowed(), item.exportAllowed());
        }
        grantRepository.flush();
        return grantViews(marketerId, advertiserId);
    }

    // ---------- 내부 ----------

    private User loadOwned(Long marketerId, Long advertiserId) {
        return userRepository.findByIdAndParentUserIdAndRole(advertiserId, marketerId, Role.ADVERTISER)
                .orElseThrow(() -> new NotFoundException("광고주를 찾을 수 없습니다."));
    }

    private static String blankToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
