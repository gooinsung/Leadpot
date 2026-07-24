package com.leadpot.landing;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.landing.dto.LandingRequest;
import com.leadpot.landing.dto.LandingResponse;
import com.leadpot.landing.dto.LandingSummary;
import com.leadpot.landing.dto.PublicLandingResponse;

import jakarta.validation.Valid;

/** 랜딩 관리 API (로그인 필요, 본인 것만 K5). */
@RestController
@RequestMapping("/api/landings")
public class LandingController {

    private final LandingService landingService;

    public LandingController(LandingService landingService) {
        this.landingService = landingService;
    }

    @GetMapping
    public List<LandingSummary> list(@AuthenticationPrincipal Jwt jwt) {
        return landingService.list(userId(jwt));
    }

    @PostMapping
    public ResponseEntity<LandingResponse> create(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody LandingRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(landingService.create(userId(jwt), request));
    }

    @GetMapping("/{id}")
    public LandingResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return landingService.get(userId(jwt), id);
    }

    /** 소유자 미리보기(/p/{slug} 용): 본인 소유 랜딩만 렌더 데이터로 반환(draft 포함). */
    @GetMapping("/preview/{slug}")
    public PublicLandingResponse preview(@AuthenticationPrincipal Jwt jwt, @PathVariable String slug) {
        return landingService.getPreview(userId(jwt), slug);
    }

    @PutMapping("/{id}")
    public LandingResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @Valid @RequestBody LandingRequest request) {
        return landingService.update(userId(jwt), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        landingService.delete(userId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
