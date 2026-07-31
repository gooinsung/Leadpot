package com.leadpot.advertiser;

import java.time.Instant;
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

import com.leadpot.advertiser.dto.AdvertiserLogResponse;
import com.leadpot.advertiser.dto.AdvertiserSummary;
import com.leadpot.advertiser.dto.AdvertiserUpdateRequest;
import com.leadpot.advertiser.dto.GrantUpdateRequest;
import com.leadpot.advertiser.dto.GrantView;
import com.leadpot.auth.Plan;
import com.leadpot.auth.Role;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.ConflictException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.common.error.PlanLimitExceededException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;

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
    private final int maxFree;
    private final int maxPro;

    public AdvertiserService(UserRepository userRepository,
            FormRepository formRepository,
            AdvertiserFormGrantRepository grantRepository,
            AdvertiserAccessLogRepository logRepository,
            AdvertiserInviteRepository inviteRepository,
            @Value("${app.advertiser.max-free}") int maxFree,
            @Value("${app.advertiser.max-pro}") int maxPro) {
        this.userRepository = userRepository;
        this.formRepository = formRepository;
        this.grantRepository = grantRepository;
        this.logRepository = logRepository;
        this.inviteRepository = inviteRepository;
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
     */
    @Transactional
    public void delete(Long marketerId, Long advertiserId) {
        User a = loadOwned(marketerId, advertiserId);
        grantRepository.deleteByAdvertiserId(a.getId());
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
