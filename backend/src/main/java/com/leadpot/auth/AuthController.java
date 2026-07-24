package com.leadpot.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.auth.dto.LoginRequest;
import com.leadpot.auth.dto.RefreshRequest;
import com.leadpot.auth.dto.SignupRequest;
import com.leadpot.auth.dto.SubdomainRequest;
import com.leadpot.auth.dto.TokenResponse;
import com.leadpot.auth.dto.UserResponse;

import jakarta.validation.Valid;

/** 인증 API. 가입/로그인/재발급은 공개, /me 는 액세스 토큰 필요. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/signup")
    public ResponseEntity<TokenResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.signup(request));
    }

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ResponseEntity.ok(authService.refresh(request.refreshToken()));
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(@AuthenticationPrincipal Jwt jwt) {
        Long userId = Long.valueOf(jwt.getSubject());
        return ResponseEntity.ok(authService.me(userId));
    }

    /** 내 서브도메인 변경(로그인 필요). */
    @PatchMapping("/subdomain")
    public ResponseEntity<UserResponse> updateSubdomain(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody SubdomainRequest request) {
        Long userId = Long.valueOf(jwt.getSubject());
        return ResponseEntity.ok(authService.updateSubdomain(userId, request.subdomain()));
    }
}
