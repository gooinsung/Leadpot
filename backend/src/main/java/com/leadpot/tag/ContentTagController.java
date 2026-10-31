package com.leadpot.tag;

import java.util.List;
import java.util.TreeSet;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.landing.LandingPage;
import com.leadpot.landing.LandingPageRepository;

/**
 * 태그 후보 목록 — 본인 리드폼·랜딩에 달린 태그를 모아 가나다순으로 준다(폼·랜딩 공용).
 * 태그 편집 칸의 체크박스와 목록 태그 검색의 재료.
 */
@RestController
@RequestMapping("/api/content-tags")
public class ContentTagController {

    private final FormRepository formRepository;
    private final LandingPageRepository landingRepository;

    public ContentTagController(FormRepository formRepository, LandingPageRepository landingRepository) {
        this.formRepository = formRepository;
        this.landingRepository = landingRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<String> list(@AuthenticationPrincipal Jwt jwt) {
        Long ownerId = Long.valueOf(jwt.getSubject());
        TreeSet<String> all = new TreeSet<>();
        for (Form f : formRepository.findByOwnerIdOrderByUpdatedAtDesc(ownerId)) {
            if (f.getTags() != null) all.addAll(f.getTags());
        }
        for (LandingPage l : landingRepository.findByOwnerIdOrderByUpdatedAtDesc(ownerId)) {
            if (l.getTags() != null) all.addAll(l.getTags());
        }
        return List.copyOf(all);
    }
}
