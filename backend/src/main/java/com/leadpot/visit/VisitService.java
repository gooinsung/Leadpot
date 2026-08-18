package com.leadpot.visit;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.common.TrackingParams;
import com.leadpot.form.FormRepository;
import com.leadpot.landing.LandingPageRepository;
import com.leadpot.lead.UserAgentParser;

/** 방문(유입) 기록. 공개 랜딩/리드폼 열람 시 best-effort 로 남긴다(실패해도 페이지엔 영향 없음). */
@Service
public class VisitService {

    private final VisitRepository visitRepository;
    private final LandingPageRepository landingRepository;
    private final FormRepository formRepository;

    public VisitService(VisitRepository visitRepository, LandingPageRepository landingRepository,
            FormRepository formRepository) {
        this.visitRepository = visitRepository;
        this.landingRepository = landingRepository;
        this.formRepository = formRepository;
    }

    /** 방문자 정보(요청 헤더에서 추출). */
    public record Visitor(String ip, String userAgent, String referer, String language) {
    }

    @Transactional
    public void record(Long landingPageId, Long formId, Map<String, Object> utm, Visitor visitor) {
        // 소유자 해석: 랜딩 우선, 없으면 리드폼. 둘 다 못 찾으면 기록하지 않는다.
        Long ownerId = null;
        if (landingPageId != null) {
            ownerId = landingRepository.findById(landingPageId).map(l -> l.getOwnerId()).orElse(null);
        }
        if (ownerId == null && formId != null) {
            ownerId = formRepository.findById(formId).map(f -> f.getOwnerId()).orElse(null);
        }
        if (ownerId == null) return;

        Visit v = new Visit();
        v.setOwnerId(ownerId);
        v.setLandingPageId(landingPageId);
        v.setFormId(formId);
        v.setDevice(UserAgentParser.device(visitor.userAgent()));
        v.setOs(UserAgentParser.os(visitor.userAgent()));
        v.setBrowser(UserAgentParser.browser(visitor.userAgent()));
        v.setLanguage(cut(visitor.language(), 40));
        v.setReferer(cut(visitor.referer(), 1024));
        // 공개 엔드포인트라 임의 키가 올 수 있다 — 허용 키만 남긴다(비면 null).
        v.setUtm(TrackingParams.sanitize(utm));
        v.setIpHash(hashIp(visitor.ip()));
        visitRepository.save(v);
    }

    /** IP 원본 대신 SHA-256 해시(hex) 저장 — 고유 방문 추정용, 개인정보 최소화. */
    private static String hashIp(String ip) {
        if (ip == null || ip.isBlank()) return null;
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(ip.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : d) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    private static String cut(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }
}
