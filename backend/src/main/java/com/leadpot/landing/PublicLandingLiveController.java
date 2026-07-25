package com.leadpot.landing;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.landing.dto.LandingLiveResponse;

/** 동적 요소(M8) 실시간 집계 공개 API(비로그인). 공개 랜딩이 렌더 시 호출해 신청수·최근 신청자를 채운다. */
@RestController
@RequestMapping("/api/public/landings")
public class PublicLandingLiveController {

    private final LandingService landingService;

    public PublicLandingLiveController(LandingService landingService) {
        this.landingService = landingService;
    }

    @GetMapping("/{id}/live")
    public LandingLiveResponse live(@PathVariable Long id) {
        return landingService.live(id);
    }
}
