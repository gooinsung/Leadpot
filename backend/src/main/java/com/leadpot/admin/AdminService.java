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
import com.leadpot.auth.Role;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.form.FormRepository;
import com.leadpot.lead.LeadRepository;
import com.leadpot.sms.MessageLogRepository;
import com.leadpot.sms.SmsPermissions;

/**
 * 운영자(어드민) 기능. 지금 범위는 <b>계정 조회 + 문자 발송 권한 통제</b>뿐이다.
 *
 * <p><b>⚠️ 리드(고객 개인정보) 열람 기능을 여기에 넣지 않는다.</b> 어드민 화면의 목적은 계정·권한
 * 관리이고, 우리는 고객 리드에 대해 수탁자 위치다. 규모 파악은 건수로 충분하다.
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
    private final MessageLogRepository messageLogRepository;
    private final AdminAuditLogRepository auditRepository;

    public AdminService(UserRepository userRepository, FormRepository formRepository,
            LeadRepository leadRepository, MessageLogRepository messageLogRepository,
            AdminAuditLogRepository auditRepository) {
        this.userRepository = userRepository;
        this.formRepository = formRepository;
        this.leadRepository = leadRepository;
        this.messageLogRepository = messageLogRepository;
        this.auditRepository = auditRepository;
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
