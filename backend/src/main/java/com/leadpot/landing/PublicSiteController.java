package com.leadpot.landing;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.landing.dto.PublicLandingResponse;

/**
 * 공개 사이트 해석 (비로그인). 서브도메인 라우팅 {subdomain}.도메인/{랜딩번호|슬러그}.
 * 프론트가 hostname 에서 서브도메인을, 경로에서 식별자를 파싱해 호출한다.
 */
@RestController
@RequestMapping("/api/public/sites")
public class PublicSiteController {

    private final LandingService landingService;

    public PublicSiteController(LandingService landingService) {
        this.landingService = landingService;
    }

    @GetMapping("/{subdomain}/{identifier}")
    public PublicLandingResponse resolve(@PathVariable String subdomain, @PathVariable String identifier) {
        return landingService.getPublicBySite(subdomain, identifier);
    }
}
