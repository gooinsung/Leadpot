package com.leadpot.admin;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.admin.dto.AdminAuditRow;
import com.leadpot.admin.dto.AdminUserRow;
import com.leadpot.admin.dto.SmsPermissionRequest;
import com.leadpot.auth.AuthService;
import com.leadpot.auth.Role;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.auth.dto.TokenResponse;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.dto.FormSummary;
import com.leadpot.landing.LandingPageRepository;
import com.leadpot.landing.dto.LandingSummary;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;
import com.leadpot.lead.dto.LeadResponse;
import com.leadpot.sms.MessageLogRepository;
import com.leadpot.sms.SmsPermissions;

/**
 * 운영자(어드민) 기능 — 계정 조회 · 문자 발송 권한 통제 · <b>계정 자산(리드폼/랜딩/리드) 읽기 전용 열람</b>.
 *
 * <p><b>정책 변경(2026-08-19, 사용자 결정)</b>: 원래 "리드(고객 개인정보) 열람을 넣지 않는다"가
 * 원칙이었으나(우리는 수탁자 위치), 운영 지원을 위해 <b>읽기 전용 열람</b>을 허용하기로 했다. 대신:
 * <ul>
 * <li><b>조회만</b> — 운영자가 남의 리드·폼·랜딩을 수정/삭제/상태변경하는 API 는 만들지 않는다.</li>
 * <li><b>리드 열람은 감사 로그에 남는다</b>({@link AdminAuditLog#ACTION_LEADS_VIEW}) —
 * 개인정보 접근이므로 누가 언제 어느 계정 것을 봤는지 추적돼야 한다.</li>
 * <li>감사 로그 {@code detail} 에 개인정보를 넣지 않는 원칙은 그대로다.</li>
 * </ul>
 *
 * <p>모든 변경은 {@link AdminAuditLog} 에 남긴다 — 권한을 켜고 끄는 기능이라 흔적이 없으면
 * 사고가 났을 때 추적이 안 된다.
 */
@Service
public class AdminService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final int AUDIT_PAGE_SIZE = 200;

    private final UserRepository userRepository;
    private final FormRepository formRepository;
    private final LeadRepository leadRepository;
    private final LandingPageRepository landingRepository;
    private final MessageLogRepository messageLogRepository;
    private final AdminAuditLogRepository auditRepository;
    private final AuthService authService;

    public AdminService(UserRepository userRepository, FormRepository formRepository,
            LeadRepository leadRepository, LandingPageRepository landingRepository,
            MessageLogRepository messageLogRepository,
            AdminAuditLogRepository auditRepository,
            AuthService authService) {
        this.userRepository = userRepository;
        this.formRepository = formRepository;
        this.leadRepository = leadRepository;
        this.landingRepository = landingRepository;
        this.messageLogRepository = messageLogRepository;
        this.auditRepository = auditRepository;
        this.authService = authService;
    }

    /**
     * 계정 목록. {@code q} 로 이메일·이름 부분검색(대소문자 무시).
     *
     * <p>리드폼·리드 건수는 <b>집계 쿼리 2회</b>로 한 번에 가져온다 — 계정마다 세면
     * 왕복이 계정 수만큼 늘어나고, DB 가 원격이라 그게 바로 수 초가 된다.
     */
    @Transactional(readOnly = true)
    public List<AdminUserRow> users(String q) {
        String needle = q == null ? "" : q.trim().toLowerCase();
        Map<Long, Long> formCounts = toCountMap(formRepository.countGroupedByOwner());
        Map<Long, Long> leadCounts = toCountMap(leadRepository.countActiveGroupedByOwner());
        Instant monthStart = monthStart();

        List<AdminUserRow> rows = new ArrayList<>();
        for (User u : userRepository.findAll()) {
            if (!needle.isEmpty() && !matches(u, needle)) {
                continue;
            }
            // 문자 사용량은 계정별로 세야 한다(집계 쿼리를 추가하기엔 계정 수가 적고, 목록에 꼭 필요한 값이다).
            long smsUsed = u.isSmsEnabled()
                    ? messageLogRepository.countSystemSentSince(u.getId(), monthStart)
                    : 0; // 권한이 없으면 0 이 자명하므로 쿼리를 아낀다
            rows.add(new AdminUserRow(u.getId(), u.getEmail(), u.getName(), u.getRole(), u.getPlan(),
                    u.isActive(), u.getSubdomain(), u.getCreatedAt(),
                    formCounts.getOrDefault(u.getId(), 0L),
                    leadCounts.getOrDefault(u.getId(), 0L),
                    u.isSmsEnabled(),
                    SmsPermissions.allowedChannels(u).stream().toList(),
                    u.getSmsMonthlyLimit(),
                    smsUsed));
        }
        // 최근 가입 순. createdAt 이 같으면 id 역순으로 안정 정렬.
        rows.sort((a, b) -> {
            if (a.createdAt() != null && b.createdAt() != null && !a.createdAt().equals(b.createdAt())) {
                return b.createdAt().compareTo(a.createdAt());
            }
            return Long.compare(b.id(), a.id());
        });
        return rows;
    }

    /**
     * 문자 발송 권한 변경. 넘어오지 않은 필드는 그대로 둔다(부분 수정).
     *
     * <p>⚠️ <b>광고주 하위계정에는 걸지 않는다</b> — 광고주는 문자를 보내는 주체가 아니다
     * (발송은 리드폼 소유 마케터 기준으로 나간다). 잘못 열어두면 통제 지점이 늘어난다.
     */
    @Transactional
    public AdminUserRow updateSmsPermissions(Long adminId, Long targetId, SmsPermissionRequest req) {
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new NotFoundException("계정을 찾을 수 없습니다."));
        if (target.getRole() == Role.ADVERTISER) {
            throw new InvalidSubmissionException("광고주 하위계정에는 문자 발송 권한을 부여할 수 없습니다.");
        }

        String before = describe(target);
        if (req.enabled() != null) {
            target.setSmsEnabled(req.enabled());
        }
        if (req.allowedChannels() != null) {
            target.setSmsAllowedChannels(SmsPermissions.normalizeChannels(String.join(",", req.allowedChannels())));
        }
        if (req.monthlyLimit() != null) {
            // 음수는 모두 무제한(-1)으로 정규화한다 — -5 같은 값이 들어와 의미가 흐려지지 않게.
            target.setSmsMonthlyLimit(req.monthlyLimit() < 0 ? SmsPermissions.UNLIMITED : req.monthlyLimit());
        }
        String after = describe(target);

        if (!before.equals(after)) {
            auditRepository.save(new AdminAuditLog(adminId, targetId,
                    AdminAuditLog.ACTION_SMS_PERMISSIONS, before + " → " + after));
        }
        return singleRow(target);
    }

    /** 계정 한 건의 목록 행. 한 명이라 건수를 개별 쿼리로 세도 왕복이 적다. */
    private AdminUserRow singleRow(User u) {
        long smsUsed = u.isSmsEnabled()
                ? messageLogRepository.countSystemSentSince(u.getId(), monthStart())
                : 0;
        return new AdminUserRow(u.getId(), u.getEmail(), u.getName(), u.getRole(), u.getPlan(),
                u.isActive(), u.getSubdomain(), u.getCreatedAt(),
                formRepository.findByOwnerIdOrderByUpdatedAtDesc(u.getId()).size(),
                leadRepository.countByOwner(u.getId()),
                u.isSmsEnabled(), SmsPermissions.allowedChannels(u).stream().toList(),
                u.getSmsMonthlyLimit(), smsUsed);
    }

    // ---------- 읽기 전용 열람 (2026-08-19 정책 변경 — 클래스 주석 참고) ----------

    /** 열람 상한 — 큰 계정의 전량 조회로 응답이 폭발하지 않게 최신순으로 자른다. */
    private static final int VIEW_PAGE_SIZE = 200;

    /** 계정의 리드폼 목록(최근 수정순). 조회 전용 — 감사 대상 아님(개인정보가 아니다). */
    @Transactional(readOnly = true)
    public List<FormSummary> forms(Long targetId) {
        requireTarget(targetId);
        return formRepository.findByOwnerIdOrderByUpdatedAtDesc(targetId).stream()
                .map(FormSummary::from)
                .toList();
    }

    /** 계정의 랜딩 목록(최근 수정순). 조회 전용 — 감사 대상 아님. */
    @Transactional(readOnly = true)
    public List<LandingSummary> landings(Long targetId) {
        requireTarget(targetId);
        return landingRepository.findByOwnerIdOrderByUpdatedAtDesc(targetId).stream()
                .map(LandingSummary::from)
                .toList();
    }

    /**
     * 계정의 리드 목록(최신순, 최대 {@value #VIEW_PAGE_SIZE}건). {@code formId} 를 주면 그 폼 것만.
     *
     * <p><b>고객 개인정보 접근이므로 호출마다 감사 로그를 남긴다</b> — 화면 새로고침도 열람이다.
     * readOnly 트랜잭션이 아닌 이유: 감사 로그를 같은 트랜잭션에서 저장해야 하기 때문이다
     * (로그 없이 열람만 성공하는 조합이 생기면 안 된다).
     */
    @Transactional
    public List<LeadResponse> leads(Long adminId, Long targetId, Long formId) {
        requireTarget(targetId);
        PageRequest page = PageRequest.of(0, VIEW_PAGE_SIZE);
        List<Lead> leads;
        if (formId == null) {
            leads = leadRepository.findByOwnerRecent(targetId, page);
        } else {
            // 폼 소유 확인 — 없으면 formId 를 바꿔가며 남의 계정 리드를 긁을 수 있다.
            Form form = formRepository.findById(formId)
                    .filter(f -> f.getOwnerId().equals(targetId))
                    .orElseThrow(() -> new NotFoundException("해당 계정의 리드폼이 아닙니다."));
            leads = leadRepository.findByFormIdAndDeletedAtIsNullOrderByCreatedAtDesc(form.getId(), page);
        }
        auditRepository.save(new AdminAuditLog(adminId, targetId, AdminAuditLog.ACTION_LEADS_VIEW,
                (formId == null ? "리드 열람(전체" : "리드 열람(폼 " + formId) + ", " + leads.size() + "건)"));
        return leads.stream().map(LeadResponse::from).toList();
    }

    /**
     * 계정 대신 로그인 — 비밀번호 없이 해당 계정의 토큰을 바로 발급한다.
     *
     * <p>⚠️ <b>이 클래스 상단 정책(읽기 전용·감사 로그 필수)의 명시적 예외다</b> — 2026-08-20
     * 사용자 요청으로 감사 로그 없이 추가했다. 호출 경로는 {@code /api/admin/**} 라
     * {@code SecurityConfig} 가 ROLE_ADMIN 만 통과시키므로 접근 자체는 운영자로 제한되지만,
     * 그 이상의 흔적(누가 언제 어느 계정으로 들어갔는지)은 남기지 않는다.
     */
    @Transactional(readOnly = true)
    public TokenResponse loginAs(Long targetId) {
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new NotFoundException("계정을 찾을 수 없습니다."));
        return authService.issueTokens(target);
    }

    private void requireTarget(Long targetId) {
        if (!userRepository.existsById(targetId)) {
            throw new NotFoundException("계정을 찾을 수 없습니다.");
        }
    }

    /** 변경 이력. targetId 를 주면 그 계정에 대한 것만. */
    @Transactional(readOnly = true)
    public List<AdminAuditRow> audit(Long targetId) {
        PageRequest page = PageRequest.of(0, AUDIT_PAGE_SIZE);
        List<AdminAuditLog> logs = targetId == null
                ? auditRepository.findByOrderByCreatedAtDesc(page)
                : auditRepository.findByTargetIdOrderByCreatedAtDesc(targetId, page);
        // 이메일은 화면에서 누가/누구를 알아보려면 필요하다. 계정 수가 적어 한 번에 담아 매핑한다.
        Map<Long, String> emails = new LinkedHashMap<>();
        userRepository.findAll().forEach(u -> emails.put(u.getId(), u.getEmail()));
        return logs.stream()
                .map(l -> AdminAuditRow.of(l, emails.get(l.getAdminId()), emails.get(l.getTargetId())))
                .toList();
    }

    // ---------- 내부 ----------

    /** 감사 이력에 남길 권한 요약. 개인정보는 넣지 않는다. */
    private static String describe(User u) {
        return "발송=" + (u.isSmsEnabled() ? "on" : "off")
                + " 채널=[" + u.getSmsAllowedChannels() + "]"
                + " 월한도=" + limitText(u.getSmsMonthlyLimit());
    }

    private static String limitText(int limit) {
        if (limit < 0) {
            return "무제한";
        }
        return limit == 0 ? "0(금지)" : limit + "건";
    }

    private static boolean matches(User u, String needle) {
        return (u.getEmail() != null && u.getEmail().toLowerCase().contains(needle))
                || (u.getName() != null && u.getName().toLowerCase().contains(needle));
    }

    /** {@code [ownerId, count]} 행들을 맵으로. */
    private static Map<Long, Long> toCountMap(List<Object[]> rows) {
        Map<Long, Long> out = new LinkedHashMap<>();
        for (Object[] row : rows) {
            if (row.length >= 2 && row[0] instanceof Number owner && row[1] instanceof Number count) {
                out.put(owner.longValue(), count.longValue());
            }
        }
        return out;
    }

    private static Instant monthStart() {
        return LocalDate.now(KST).withDayOfMonth(1).atStartOfDay(KST).toInstant();
    }
}
