package com.leadpot.event;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.form.FormRepository;
import com.leadpot.landing.LandingPageRepository;

/** 요소 상호작용 이벤트 기록(I4/I5). 공개 랜딩/리드폼에서 best-effort 로 남긴다(실패해도 페이지엔 영향 없음). */
@Service
public class InteractionEventService {

    private final InteractionEventRepository eventRepository;
    private final LandingPageRepository landingRepository;
    private final FormRepository formRepository;

    public InteractionEventService(InteractionEventRepository eventRepository,
            LandingPageRepository landingRepository, FormRepository formRepository) {
        this.eventRepository = eventRepository;
        this.landingRepository = landingRepository;
        this.formRepository = formRepository;
    }

    @Transactional
    public void record(Long landingPageId, Long formId, String eventType, String target, String ip) {
        if (eventType == null || eventType.isBlank()) {
            return;
        }
        // 소유자 해석: 랜딩 우선, 없으면 리드폼. 둘 다 못 찾으면 기록하지 않는다.
        Long ownerId = null;
        if (landingPageId != null) {
            ownerId = landingRepository.findById(landingPageId).map(l -> l.getOwnerId()).orElse(null);
        }
        if (ownerId == null && formId != null) {
            ownerId = formRepository.findById(formId).map(f -> f.getOwnerId()).orElse(null);
        }
        if (ownerId == null) {
            return;
        }

        InteractionEvent e = new InteractionEvent();
        e.setOwnerId(ownerId);
        e.setLandingPageId(landingPageId);
        e.setFormId(formId);
        e.setEventType(cut(eventType.trim(), 40));
        e.setTarget(cut(target, 255));
        e.setIpHash(hashIp(ip));
        eventRepository.save(e);
    }

    /** IP 원본 대신 SHA-256 해시(hex) 저장 — 고유 방문자 추정용, 개인정보 최소화. */
    private static String hashIp(String ip) {
        if (ip == null || ip.isBlank()) {
            return null;
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(ip.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : d) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    private static String cut(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() > max ? s.substring(0, max) : s;
    }
}
