package com.leadpot.advertiser;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.advertiser.dto.PasswordResetInfoResponse;
import com.leadpot.advertiser.dto.PasswordResetRequest;
import com.leadpot.auth.dto.TokenResponse;

import jakarta.validation.Valid;

/**
 * 광고주 비밀번호 재설정 (비로그인 공개 경로).
 * 토큰은 256비트 난수이고 DB에는 해시만 있다. 1회용이며 만료된다.
 */
@RestController
@RequestMapping("/api/public/advertiser-password-resets")
public class PublicAdvertiserPasswordResetController {

    private final AdvertiserPasswordResetService service;

    public PublicAdvertiserPasswordResetController(AdvertiserPasswordResetService service) {
        this.service = service;
    }

    /** 링크 유효성 확인 + 화면에 보여줄 정보. */
    @GetMapping("/{token}")
    public PasswordResetInfoResponse info(@PathVariable String token) {
        return service.info(token);
    }

    /** 새 비밀번호 설정 → 자동 로그인 토큰 반환. */
    @PostMapping("/{token}")
    public TokenResponse complete(@PathVariable String token, @Valid @RequestBody PasswordResetRequest request) {
        return service.complete(token, request.password());
    }
}
