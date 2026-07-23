package com.leadpot.auth;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.auth.dto.LoginRequest;
import com.leadpot.auth.dto.SignupRequest;
import com.leadpot.auth.dto.TokenResponse;
import com.leadpot.auth.dto.UserResponse;
import com.leadpot.common.error.EmailAlreadyUsedException;
import com.leadpot.common.error.InvalidCredentialsException;
import com.leadpot.common.error.InvalidRefreshTokenException;
import com.leadpot.common.security.JwtService;

/** 인증 관련 비즈니스 로직: 회원가입 · 로그인 · 토큰 재발급. */
@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public TokenResponse signup(SignupRequest req) {
        String email = normalizeEmail(req.email());
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyUsedException("이미 사용 중인 이메일입니다.");
        }
        User user = new User(
                email,
                passwordEncoder.encode(req.password()),
                req.name().trim(),
                normalizePhone(req.phone()));
        userRepository.save(user);
        return buildTokens(user);
    }

    @Transactional(readOnly = true)
    public TokenResponse login(LoginRequest req) {
        String email = normalizeEmail(req.email());
        // 사용자 존재 여부를 노출하지 않도록 실패 메시지는 동일하게 유지
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new InvalidCredentialsException("이메일 또는 비밀번호가 올바르지 않습니다."));
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("이메일 또는 비밀번호가 올바르지 않습니다.");
        }
        return buildTokens(user);
    }

    /** 현재 로그인한 계정 정보 조회 (액세스 토큰의 subject 기준). */
    @Transactional(readOnly = true)
    public UserResponse me(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new InvalidCredentialsException("계정을 찾을 수 없습니다."));
        return UserResponse.from(user);
    }

    @Transactional(readOnly = true)
    public TokenResponse refresh(String refreshToken) {
        Long userId = jwtService.parseRefreshTokenUserId(refreshToken);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new InvalidRefreshTokenException("해당 계정을 찾을 수 없습니다."));
        return buildTokens(user);
    }

    private TokenResponse buildTokens(User user) {
        String access = jwtService.issueAccessToken(user);
        String refresh = jwtService.issueRefreshToken(user);
        return TokenResponse.of(access, refresh, jwtService.getAccessTtlSeconds(), UserResponse.from(user));
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }

    private String normalizePhone(String phone) {
        if (phone == null) {
            return null;
        }
        String trimmed = phone.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
