package com.leadpot.advertiser;

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

import com.leadpot.advertiser.dto.AdvertiserProfileRequest;
import com.leadpot.advertiser.dto.AdvertiserProfileResponse;

import jakarta.validation.Valid;

/**
 * 광고주 정보 API(마케터). 경로가 {@code /api/advertiser/**}(광고주 포털 전용)와 겹치지 않게
 * {@code /api/advertiser-profiles} 를 쓴다.
 */
@RestController
@RequestMapping("/api/advertiser-profiles")
public class AdvertiserProfileController {

    private final AdvertiserProfileService service;

    public AdvertiserProfileController(AdvertiserProfileService service) {
        this.service = service;
    }

    @GetMapping
    public List<AdvertiserProfileResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return service.list(userId(jwt));
    }

    @GetMapping("/{id}")
    public AdvertiserProfileResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return service.get(userId(jwt), id);
    }

    @PostMapping
    public ResponseEntity<AdvertiserProfileResponse> create(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody AdvertiserProfileRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(userId(jwt), request));
    }

    @PutMapping("/{id}")
    public AdvertiserProfileResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @Valid @RequestBody AdvertiserProfileRequest request) {
        return service.update(userId(jwt), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        service.delete(userId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
