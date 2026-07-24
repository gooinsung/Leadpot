package com.leadpot.landing;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.common.error.NotFoundException;
import com.leadpot.form.FormRepository;
import com.leadpot.form.dto.FormResponse;
import com.leadpot.landing.dto.LandingRequest;
import com.leadpot.landing.dto.LandingResponse;
import com.leadpot.landing.dto.LandingSummary;
import com.leadpot.landing.dto.PublicLandingResponse;

/** 랜딩 CRUD(본인만 K5) + 공개 렌더(FORM 블록의 폼 정의 함께 반환). */
@Service
public class LandingService {

    private final LandingPageRepository landingRepository;
    private final FormRepository formRepository;

    public LandingService(LandingPageRepository landingRepository, FormRepository formRepository) {
        this.landingRepository = landingRepository;
        this.formRepository = formRepository;
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
        LandingPage landing = new LandingPage(ownerId, req.title().trim(), generateSlug(req.title()));
        landing.setContent(req.contentOrEmpty());
        landing.setStatus(status(req.status()));
        landingRepository.save(landing);
        return LandingResponse.from(landing);
    }

    @Transactional
    public LandingResponse update(Long ownerId, Long id, LandingRequest req) {
        LandingPage landing = load(ownerId, id);
        landing.setTitle(req.title().trim());
        landing.setContent(req.contentOrEmpty());
        landing.setStatus(status(req.status()));
        return LandingResponse.from(landing);
    }

    @Transactional
    public void delete(Long ownerId, Long id) {
        landingRepository.delete(load(ownerId, id));
    }

    /** 공개 렌더: 슬러그로 랜딩 + FORM 블록이 참조하는 폼 정의를 함께 반환. */
    @Transactional(readOnly = true)
    public PublicLandingResponse getPublic(String slug) {
        LandingPage landing = landingRepository.findBySlug(slug)
                .orElseThrow(() -> new NotFoundException("페이지를 찾을 수 없습니다."));
        // 비공개(draft) 페이지는 공개 접근 차단 — 존재를 드러내지 않도록 동일한 404.
        if (!"published".equals(landing.getStatus())) {
            throw new NotFoundException("페이지를 찾을 수 없습니다.");
        }
        Map<Long, FormResponse> forms = new LinkedHashMap<>();
        for (Map<String, Object> block : landing.getContent()) {
            if ("FORM".equals(String.valueOf(block.get("type")))) {
                Long formId = toLong(block.get("formId"));
                if (formId != null && !forms.containsKey(formId)) {
                    formRepository.findById(formId).ifPresent(f -> forms.put(formId, FormResponse.from(f)));
                }
            }
        }
        return new PublicLandingResponse(landing.getId(), landing.getTitle(), landing.getContent(), forms);
    }

    private LandingPage load(Long ownerId, Long id) {
        return landingRepository.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new NotFoundException("랜딩을 찾을 수 없습니다."));
    }

    private String status(String s) {
        return "draft".equals(s) ? "draft" : "published";
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
