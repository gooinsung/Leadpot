package com.leadpot.advertiser;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.advertiser.dto.PasswordResetInfoResponse;
import com.leadpot.advertiser.dto.PasswordResetResponse;
import com.leadpot.auth.AuthService;
import com.leadpot.auth.Role;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.auth.dto.TokenResponse;
import com.leadpot.common.error.ConflictException;
import com.leadpot.common.error.NotFoundException;

/**
 * 광고주 비밀번호 재설정. 마케터가 링크를 발급하고 광고주가 새 비밀번호를 직접 정한다.
 * <p>
 * 마케터가 임시 비밀번호를 정해주는 방식을 쓰지 않는 이유는 초대와 같다 —
 * 마케터가 광고주 비밀번호를 알면 감사 로그(누가 언제 열람했는지)의 증거 가치가 사라진다.
 */
@Service
public class AdvertiserPasswordResetService {

    private final AdvertiserPasswordResetRepository resetRepository;
    private final UserRepository userRepository;
    private final AuthService authService;
    private final PasswordEncoder passwordEncoder;
    private final long ttlHours;

    public AdvertiserPasswordResetService(AdvertiserPasswordResetRepository resetRepository,
            UserRepository userRepository,
            AuthService authService,
            PasswordEncoder passwordEncoder,
            @Value("${app.advertiser.password-reset-ttl-hours}") long ttlHours) {
        this.resetRepository = resetRepository;
        this.userRepository = userRepository;
        this.authService = authService;
        this.passwordEncoder = passwordEncoder;
        this.ttlHours = ttlHours;
    }

    /** 마케터가 자기 광고주의 재설정 링크를 발급. 기존 미사용 링크는 즉시 무효화된다. */
    @Transactional
    public PasswordResetResponse issue(Long marketerId, Long advertiserId) {
        User advertiser = userRepository
                .findByIdAndParentUserIdAndRole(advertiserId, marketerId, Role.ADVERTISER)
                .orElseThrow(() -> new NotFoundException("광고주를 찾을 수 없습니다."));

        // 링크가 여러 개 살아 있으면 회수 관리가 어려워진다 → 이전 링크는 사용 처리로 막는다.
        Instant now = Instant.now();
        for (AdvertiserPasswordReset old : resetRepository.findByAdvertiserIdAndUsedAtIsNull(advertiserId)) {
            old.markUsed(now);
        }

        String token = InviteTokens.newToken();
        AdvertiserPasswordReset reset = new AdvertiserPasswordReset(advertiserId, marketerId,
                InviteTokens.hash(token), now.plus(ttlHours, ChronoUnit.HOURS));
        resetRepository.save(reset);
        return new PasswordResetResponse(advertiser.getEmail(), token, reset.getExpiresAt());
    }

    @Transactional(readOnly = true)
    public PasswordResetInfoResponse info(String token) {
        AdvertiserPasswordReset reset = loadUsable(token);
        User advertiser = userRepository.findById(reset.getAdvertiserId())
                .orElseThrow(() -> new NotFoundException("계정을 찾을 수 없습니다."));
        User marketer = advertiser.getParentUserId() == null ? null
                : userRepository.findById(advertiser.getParentUserId()).orElse(null);
        return new PasswordResetInfoResponse(advertiser.getEmail(),
                marketer == null ? null : marketer.getName(),
                marketer == null ? null : marketer.getCompany());
    }

    /** 새 비밀번호 설정 → 링크 사용 처리 → 자동 로그인 토큰 반환. */
    @Transactional
    public TokenResponse complete(String token, String rawPassword) {
        AdvertiserPasswordReset reset = loadUsable(token);
        User advertiser = userRepository.findById(reset.getAdvertiserId())
                .filter(u -> u.getRole() == Role.ADVERTISER)
                .orElseThrow(() -> new NotFoundException("계정을 찾을 수 없습니다."));
        if (!advertiser.isActive()) {
            throw new ConflictException("정지된 계정입니다. 담당 마케터에게 문의해주세요.");
        }
        advertiser.setPasswordHash(passwordEncoder.encode(rawPassword));
        reset.markUsed(Instant.now());
        return authService.issueTokens(advertiser);
    }

    private AdvertiserPasswordReset loadUsable(String token) {
        if (token == null || token.isBlank()) {
            throw new NotFoundException("재설정 링크가 올바르지 않습니다.");
        }
        AdvertiserPasswordReset reset = resetRepository.findByTokenHash(InviteTokens.hash(token))
                .orElseThrow(() -> new NotFoundException("재설정 링크가 올바르지 않습니다."));
        if (reset.getUsedAt() != null) {
            throw new ConflictException("이미 사용된 링크입니다. 담당 마케터에게 새 링크를 요청해주세요.");
        }
        if (!reset.getExpiresAt().isAfter(Instant.now())) {
            throw new ConflictException("링크가 만료되었습니다. 담당 마케터에게 새 링크를 요청해주세요.");
        }
        return reset;
    }
}
