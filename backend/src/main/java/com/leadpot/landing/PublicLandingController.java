package com.leadpot.landing;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.landing.dto.PublicLandingResponse;

/** 공개 랜딩 렌더 데이터 (비로그인). /p/{slug} 가 사용. */
@RestController
@RequestMapping("/api/public/landings")
public class PublicLandingController {

    private final LandingService landingService;

    public PublicLandingController(LandingService landingService) {
        this.landingService = landingService;
    }

    @GetMapping("/{slug}")
    public PublicLandingResponse get(@PathVariable String slug) {
        return landingService.getPublic(slug);
    }
}
