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
import com.leadpot.auth.dto.PasswordResetConfirmBody;
import com.leadpot.auth.dto.PasswordResetRequestBody;
import com.leadpot.auth.dto.RefreshRequest;
import com.leadpot.auth.dto.SignupRequest;
import com.leadpot.auth.dto.SubdomainRequest;
import com.leadpot.auth.dto.TokenResponse;
import com.leadpot.auth.dto.UserResponse;
import com.leadpot.common.ClientIp;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

/** 인증 API. 가입/로그인/재발급은 공개, /me 는 액세스 토큰 필요. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;

    public AuthController(AuthService authService, PasswordResetService passwordResetService) {
        this.authService = authService;
        this.passwordResetService = passwordResetService;
    }

    @PostMapping("/signup")
    public ResponseEntity<TokenResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.signup(request));
    }

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest request,
            HttpServletRequest http) {
        return ResponseEntity.ok(authService.login(request, ClientIp.of(http)));
    }

    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ResponseEntity.ok(authService.refresh(request.refreshToken()));
    }

    /**
     * 비밀번호 재설정 인증번호 발송(공개). 계정 존재 여부와 무관하게 <b>항상 204</b> —
     * 응답을 구분하면 가입 이메일을 하나씩 확인할 수 있다({@link PasswordResetService} 주석).
     */
    @PostMapping("/password-reset/request")
    public ResponseEntity<Void> requestPasswordReset(@Valid @RequestBody PasswordResetRequestBody request) {
        passwordResetService.request(request.email());
        return ResponseEntity.noContent().build();
    }

    /** 인증번호 확인 + 새 비밀번호 설정(공개). 성공하면 자동 로그인 토큰을 준다. */
    @PostMapping("/password-reset/confirm")
    public ResponseEntity<TokenResponse> confirmPasswordReset(
            @Valid @RequestBody PasswordResetConfirmBody request) {
        return ResponseEntity.ok(passwordResetService.confirm(
                request.email(), request.code(), request.password()));
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
