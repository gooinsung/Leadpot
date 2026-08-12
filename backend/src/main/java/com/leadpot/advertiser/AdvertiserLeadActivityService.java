package com.leadpot.advertiser;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.advertiser.dto.AdvertiserLogResponse;
import com.leadpot.advertiser.dto.LeadAdvertiserActivityResponse;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.form.FormService;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;

/**
 * 마케터가 <b>"이 리드를 광고주가 보기는 했나"</b>를 확인하는 조회 전용 서비스(V33).
 *
 * <p>새 표를 만들지 않는다 — 이미 쌓고 있는 {@code advertiser_access_logs}(append-only)와
 * {@code advertiser_seen_at} 을 리드 단위로 모아 보여줄 뿐이다.
 *
 * <p>⚠️ 마케터 <b>대리 열람</b>(impersonate)은 여기 섞이지 않는다. IMPERSONATE 로그에는 lead_id 가 없고,
 * 대리 열람 경로({@link AdvertiserLeadService#leadReadOnly})는 열람 기록을 남기지 않기 때문이다.
 * 마케터가 들여다본 것을 광고주가 확인한 것처럼 보이면 이 화면의 존재 이유가 사라진다.
 */
@Service
public class AdvertiserLeadActivityService {

    private final LeadRepository leadRepository;
    private final FormService formService;
    private final AdvertiserFormGrantRepository grantRepository;
    private final AdvertiserAccessLogRepository logRepository;
    private final UserRepository userRepository;

    public AdvertiserLeadActivityService(LeadRepository leadRepository,
            FormService formService,
            AdvertiserFormGrantRepository grantRepository,
            AdvertiserAccessLogRepository logRepository,
            UserRepository userRepository) {
        this.leadRepository = leadRepository;
        this.formService = formService;
        this.grantRepository = grantRepository;
        this.logRepository = logRepository;
        this.userRepository = userRepository;
    }

    /**
     * 이 리드에 대한 광고주 활동 요약 + 이력. 내 리드폼의 리드가 아니면 404.
     *
     * @param ownerId 마케터(리드폼 소유자) id
     */
    @Transactional(readOnly = true)
    public LeadAdvertiserActivityResponse of(Long ownerId, Long leadId) {
        Lead lead = leadRepository.findById(leadId)
                .orElseThrow(() -> new NotFoundException("리드를 찾을 수 없습니다."));
        formService.get(ownerId, lead.getFormId()); // 소유권 확인(아니면 404)

        AdvertiserFormGrant grant = grantRepository.findByFormId(lead.getFormId()).orElse(null);
        if (grant == null) {
            return LeadAdvertiserActivityResponse.none(leadId);
        }
        User advertiser = userRepository.findById(grant.getAdvertiserId()).orElse(null);

        List<AdvertiserLogResponse> entries = new ArrayList<>();
        Instant lastViewedAt = null;
        int viewCount = 0;
        boolean acted = false;
        for (AdvertiserAccessLog l : logRepository.findByLeadIdOrderByCreatedAtAsc(leadId)) {
            entries.add(AdvertiserLogResponse.from(l));
            switch (l.getAction()) {
                case AdvertiserAccessLog.ACTION_VIEW_LEAD -> {
                    viewCount++;
                    lastViewedAt = l.getCreatedAt();
                }
                case AdvertiserAccessLog.ACTION_STATUS, AdvertiserAccessLog.ACTION_MEMO -> acted = true;
                default -> { /* 그 밖의 액션은 이력에만 싣는다 */ }
            }
        }

        // 최초 열람은 advertiser_seen_at 이 정본이다. 로그를 매 열람마다 남기기 전(V33 이전)에 본 리드는
        // 로그가 '최초 열람' 한 줄뿐이거나 아예 없을 수 있어서, 없을 때만 로그 첫 줄로 메운다.
        Instant firstViewedAt = lead.getAdvertiserSeenAt();
        if (firstViewedAt == null && viewCount > 0) {
            firstViewedAt = entries.stream()
                    .filter(e -> AdvertiserAccessLog.ACTION_VIEW_LEAD.equals(e.action()))
                    .map(AdvertiserLogResponse::createdAt).findFirst().orElse(null);
        }
        if (lastViewedAt == null) {
            lastViewedAt = firstViewedAt;
        }
        if (viewCount == 0 && firstViewedAt != null) {
            viewCount = 1; // 로그가 유실됐어도 열람 사실 자체는 seen_at 이 증명한다
        }

        return new LeadAdvertiserActivityResponse(
                leadId,
                grant.getAdvertiserId(),
                displayName(advertiser),
                advertiser == null ? null : advertiser.getEmail(),
                advertiser != null && advertiser.isActive(),
                logRepository.findLastLoginAt(grant.getAdvertiserId()),
                firstViewedAt,
                lastViewedAt,
                viewCount,
                acted,
                LeadAdvertiserActivityResponse.level(acted, viewCount),
                entries);
    }

    /** 회사명 → 이름 → 이메일 순. 계정이 지워졌으면 그렇게 표시한다. */
    private static String displayName(User advertiser) {
        if (advertiser == null) {
            return "삭제된 광고주";
        }
        if (advertiser.getCompany() != null && !advertiser.getCompany().isBlank()) {
            return advertiser.getCompany();
        }
        if (advertiser.getName() != null && !advertiser.getName().isBlank()) {
            return advertiser.getName();
        }
        return advertiser.getEmail();
    }
}
