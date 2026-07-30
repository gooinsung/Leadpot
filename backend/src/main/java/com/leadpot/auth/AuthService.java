package com.leadpot.auth;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.advertiser.AdvertiserAuditService;
import com.leadpot.auth.dto.LoginRequest;
import com.leadpot.auth.dto.SignupRequest;
import com.leadpot.auth.dto.TokenResponse;
import com.leadpot.auth.dto.UserResponse;
import com.leadpot.common.error.EmailAlreadyUsedException;
import com.leadpot.common.error.InvalidCredentialsException;
import com.leadpot.common.error.InvalidRefreshTokenException;
import com.leadpot.common.error.InvalidSubdomainException;
import com.leadpot.common.error.SubdomainTakenException;
import com.leadpot.common.security.JwtService;

/** 인증 관련 비즈니스 로직: 회원가입 · 로그인 · 토큰 재발급. */
@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AdvertiserAuditService advertiserAudit;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService,
            AdvertiserAuditService advertiserAudit) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.advertiserAudit = advertiserAudit;
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
        user.setSubdomain(generateUniqueSubdomain());
        userRepository.save(user);
        return buildTokens(user);
    }

    /** 서브도메인 변경(형식·예약어·중복 검증). 본인 것과 동일하면 통과. */
    @Transactional
    public UserResponse updateSubdomain(Long userId, String raw) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new InvalidCredentialsException("계정을 찾을 수 없습니다."));
        String s = Subdomains.normalize(raw);
        if (!Subdomains.isValidFormat(s)) {
            throw new InvalidSubdomainException(
                    "서브도메인은 소문자·숫자·하이픈 3~30자여야 하며, 하이픈으로 시작하거나 끝날 수 없습니다.");
        }
        if (Subdomains.isReserved(s)) {
            throw new InvalidSubdomainException("사용할 수 없는 서브도메인입니다.");
        }
        if (!s.equals(user.getSubdomain()) && userRepository.existsBySubdomain(s)) {
            throw new SubdomainTakenException("이미 사용 중인 서브도메인입니다.");
        }
        user.setSubdomain(s);
        return UserResponse.from(user);
    }

    /** 가입 시 유일한 랜덤 서브도메인 생성. */
    private String generateUniqueSubdomain() {
        for (int i = 0; i < 10; i++) {
            String s = Subdomains.random();
            if (!userRepository.existsBySubdomain(s)) {
                return s;
            }
        }
        throw new IllegalStateException("서브도메인 생성에 실패했습니다. 다시 시도해주세요.");
    }

    public TokenResponse login(LoginRequest req) {
        return login(req, null);
    }

    /** 로그인. 광고주 계정이면 감사 로그에 LOGIN 을 남긴다(마케터가 마지막 접속을 확인할 수 있게). */
    @Transactional(readOnly = true)
    public TokenResponse login(LoginRequest req, String ip) {
        String email = normalizeEmail(req.email());
        // 사용자 존재 여부를 노출하지 않도록 실패 메시지는 동일하게 유지
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new InvalidCredentialsException("이메일 또는 비밀번호가 올바르지 않습니다."));
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("이메일 또는 비밀번호가 올바르지 않습니다.");
        }
        // 정지된 계정(광고주 계약 해지 등)은 비밀번호가 맞아도 로그인 불가
        if (!user.isActive()) {
            throw new InvalidCredentialsException("정지된 계정입니다. 담당자에게 문의해주세요.");
        }
        advertiserAudit.recordLogin(user, ip);
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
        // 재발급 시점에 계정 상태를 다시 확인한다. 리프레시 토큰은 수명이 길어서
        // 이 검사가 없으면 계정을 정지해도 토큰만으로 계속 접근할 수 있다.
        if (!user.isActive()) {
            throw new InvalidRefreshTokenException("정지된 계정입니다.");
        }
        return buildTokens(user);
    }

    /**
     * 계정 생성 직후 자동 로그인 토큰 발급 (광고주 초대 수락 등 가입 외 경로에서 사용).
     * 토큰 발급 로직을 한 곳으로 유지하기 위해 공개한다.
     */
    public TokenResponse issueTokens(User user) {
        return buildTokens(user);
    }

    private TokenResponse buildTokens(User user) {
        String access = jwtService.issueAccessToken(user);
        String refresh = jwtService.issueRefreshToken(user);
        return TokenResponse.of(access, refresh, jwtService.getAccessTtlSeconds(user), UserResponse.from(user));
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
