package com.leadpot.landing;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.form.FormRepository;
import com.leadpot.form.dto.FormResponse;
import com.leadpot.landing.dto.LandingLiveResponse;
import com.leadpot.landing.dto.LandingRequest;
import com.leadpot.landing.dto.LandingResponse;
import com.leadpot.landing.dto.LandingSummary;
import com.leadpot.landing.dto.PublicLandingResponse;
import com.leadpot.ipblock.SiteIpBlockService;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;

/** 랜딩 CRUD(본인만 K5) + 공개 렌더(FORM 블록의 리드폼 정의 함께 반환) + 동적 요소 실시간 집계. */
@Service
public class LandingService {

    private final LandingPageRepository landingRepository;
    private final FormRepository formRepository;
    private final UserRepository userRepository;
    private final LeadRepository leadRepository;
    private final SiteIpBlockService siteIpBlockService;

    public LandingService(LandingPageRepository landingRepository, FormRepository formRepository,
            UserRepository userRepository, LeadRepository leadRepository,
            SiteIpBlockService siteIpBlockService) {
        this.landingRepository = landingRepository;
        this.formRepository = formRepository;
        this.userRepository = userRepository;
        this.leadRepository = leadRepository;
        this.siteIpBlockService = siteIpBlockService;
    }

    /**
     * 동적 요소(M8)용 실시간 집계: 랜딩에 연결된 리드폼들의 활성 리드 수 + 최근 신청자(첫 항목 마스킹).
     * 공개 조회(비로그인). 개인정보 최소화를 위해 이름은 첫 글자만 노출한다.
     */
    @Transactional(readOnly = true)
    public LandingLiveResponse live(Long landingId) {
        LandingPage landing = landingId == null ? null : landingRepository.findById(landingId).orElse(null);
        if (landing == null || landing.getContent() == null) {
            return new LandingLiveResponse(0, List.of());
        }
        java.util.LinkedHashSet<Long> formIds = new java.util.LinkedHashSet<>();
        for (Map<String, Object> block : landing.getContent()) {
            if ("FORM".equals(String.valueOf(block.get("type")))) {
                Long fid = toLong(block.get("formId"));
                if (fid != null) {
                    formIds.add(fid);
                }
            }
        }
        if (formIds.isEmpty()) {
            return new LandingLiveResponse(0, List.of());
        }
        long count = leadRepository.countByFormIdInAndDeletedAtIsNull(formIds);
        List<LandingLiveResponse.Recent> recent = leadRepository
                .findTop10ByFormIdInAndDeletedAtIsNullOrderByCreatedAtDesc(formIds).stream()
                .map(l -> new LandingLiveResponse.Recent(maskName(firstAnswer(l)), l.getCreatedAt()))
                .toList();
        return new LandingLiveResponse(count, recent);
    }

    /** 리드의 첫 번째(=리드폼 첫 항목) 답변 값. */
    private static String firstAnswer(Lead l) {
        if (l.getAnswers() == null) {
            return "";
        }
        for (Map<String, Object> a : l.getAnswers()) {
            Object v = a.get("value");
            if (v != null && !v.toString().isBlank()) {
                return v.toString();
            }
        }
        return "";
    }

    /** 이름 마스킹: 첫 글자만 노출(예: 김철수 → 김**). 개인정보 보호. */
    private static String maskName(String s) {
        if (s == null || s.isBlank()) {
            return "익명";
        }
        String t = s.trim();
        if (t.length() <= 1) {
            return t + "*";
        }
        int stars = Math.min(3, t.length() - 1);
        return t.substring(0, 1) + "*".repeat(stars);
    }

    @Transactional(readOnly = true)
    public List<LandingSummary> list(Long ownerId) {
        return landingRepository.findByOwnerIdOrderByUpdatedAtDesc(ownerId)
                .stream().map(LandingSummary::from).toList();
    }

    @Transactional(readOnly = true)
    public LandingResponse get(Long ownerId, Long id) {
        return LandingResponse.from(load(ownerId, id));
    }

    @Transactional
    public LandingResponse create(Long ownerId, LandingRequest req) {
        LandingPage landing = new LandingPage(ownerId, req.title().trim(), resolveSlug(req.slug(), req.title(), null));
        landing.setContent(req.contentOrEmpty());
        landing.setStatus(status(req.status()));
        landing.setTracking(req.tracking());
        landingRepository.save(landing);
        return LandingResponse.from(landing);
    }

    @Transactional
    public LandingResponse update(Long ownerId, Long id, LandingRequest req) {
        LandingPage landing = load(ownerId, id);
        landing.setTitle(req.title().trim());
        // slug 를 보낸 경우에만 변경(형식·중복 검사, 자기 자신 제외). 미지정이면 기존 유지.
        if (req.slug() != null && !req.slug().isBlank()) {
            landing.setSlug(resolveSlug(req.slug(), req.title(), landing.getId()));
        }
        landing.setContent(req.contentOrEmpty());
        landing.setStatus(status(req.status()));
        landing.setTracking(req.tracking());
        return LandingResponse.from(landing);
    }

    @Transactional
    public void delete(Long ownerId, Long id) {
        landingRepository.delete(load(ownerId, id));
    }

    /**
     * 공개 렌더: 서브도메인으로 소유자를 찾고, 식별자(숫자=랜딩번호 / 문자=슬러그)로 랜딩을 해석.
     * 공개 접근은 published 만 허용(비공개는 존재를 드러내지 않도록 404).
     */
    @Transactional(readOnly = true)
    public PublicLandingResponse getPublicBySite(String subdomain, String identifier, String clientIp) {
        User owner = userRepository.findBySubdomain(subdomain == null ? "" : subdomain.toLowerCase())
                .orElseThrow(() -> new NotFoundException("페이지를 찾을 수 없습니다."));
        // 계정 전역 접속 차단: 차단 IP 에는 페이지의 존재조차 알리지 않는다(비공개 랜딩과 같은 404).
        if (siteIpBlockService.isBlocked(owner.getId(), clientIp)) {
            throw new NotFoundException("페이지를 찾을 수 없습니다.");
        }
        LandingPage landing = resolveLanding(owner.getId(), identifier)
                .orElseThrow(() -> new NotFoundException("페이지를 찾을 수 없습니다."));
        if (!"published".equals(landing.getStatus())) {
            throw new NotFoundException("페이지를 찾을 수 없습니다.");
        }
        return buildPublic(landing);
    }

    /**
     * 소유자 미리보기: 기존 /p/{slug} 경로용. 로그인한 본인 소유 랜딩만(draft 포함) 반환.
     * 남의 슬러그이거나 존재하지 않으면 404(존재 비노출).
     */
    @Transactional(readOnly = true)
    public PublicLandingResponse getPreview(Long ownerId, String slug) {
        LandingPage landing = landingRepository.findBySlugAndOwnerId(slug, ownerId)
                .orElseThrow(() -> new NotFoundException("페이지를 찾을 수 없습니다."));
        return buildPublic(landing);
    }

    /** 식별자 해석: 숫자면 랜딩번호(id), 아니면 슬러그. 항상 소유자 범위 내에서. */
    private Optional<LandingPage> resolveLanding(Long ownerId, String identifier) {
        if (identifier != null && identifier.matches("\\d+")) {
            try {
                return landingRepository.findByIdAndOwnerId(Long.valueOf(identifier), ownerId);
            } catch (NumberFormatException e) {
                return Optional.empty();
            }
        }
        return landingRepository.findBySlugAndOwnerId(identifier, ownerId);
    }

    /** FORM 블록이 참조하는 리드폼 정의를 함께 묶어 공개 응답 생성. */
    private PublicLandingResponse buildPublic(LandingPage landing) {
        Map<Long, FormResponse> forms = new LinkedHashMap<>();
        for (Map<String, Object> block : landing.getContent()) {
            if ("FORM".equals(String.valueOf(block.get("type")))) {
                Long formId = toLong(block.get("formId"));
                if (formId != null && !forms.containsKey(formId)) {
                    formRepository.findById(formId).ifPresent(f -> forms.put(formId, FormResponse.from(f)));
                }
            }
        }
        return new PublicLandingResponse(landing.getId(), landing.getTitle(), landing.getContent(), forms, landing.getTracking());
    }

    private LandingPage load(Long ownerId, Long id) {
        return landingRepository.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new NotFoundException("랜딩을 찾을 수 없습니다."));
    }

    private String status(String s) {
        return "draft".equals(s) ? "draft" : "published";
    }

    /** 사용자가 지정한 slug 를 검증·중복확인 후 반환. 미지정이면 제목 기반 자동 생성. */
    private String resolveSlug(String requested, String title, Long excludeId) {
        if (requested == null || requested.isBlank()) {
            return generateSlug(title);
        }
        // 영문은 소문자로 정규화(한글은 대소문자 개념이 없어 영향 없음).
        String s = requested.trim().toLowerCase(java.util.Locale.ROOT);
        // 허용: 한글(가-힣)·영소문자·숫자·하이픈. 하이픈으로 시작/끝 불가. 2~120자.
        if (s.length() < 2 || s.length() > 120
                || !s.matches("^[a-z0-9가-힣][a-z0-9가-힣-]*[a-z0-9가-힣]$")) {
            throw new InvalidSubmissionException(
                    "주소(slug)는 한글·소문자·숫자·하이픈 2~120자여야 하며, 하이픈으로 시작하거나 끝날 수 없습니다.");
        }
        boolean taken = landingRepository.findBySlug(s)
                .map(l -> excludeId == null || !l.getId().equals(excludeId))
                .orElse(false);
        if (taken) {
            throw new InvalidSubmissionException("이미 사용 중인 주소(slug)입니다.");
        }
        return s;
    }

    /** 슬러그 생성: 제목의 영숫자 기반 + 랜덤 접미. 한글 제목 등은 landing-xxxx 형태. 유일성 보장. */
    private String generateSlug(String title) {
        String base = title == null ? "" : title.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        if (base.isBlank()) base = "landing";
        if (base.length() > 100) base = base.substring(0, 100);
        for (int i = 0; i < 5; i++) {
            String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 5);
            String slug = base + "-" + suffix;
            if (!landingRepository.existsBySlug(slug)) return slug;
        }
        return base + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }

    private static Long toLong(Object o) {
        if (o instanceof Number n) return n.longValue();
        try {
            return o == null ? null : Long.valueOf(o.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
