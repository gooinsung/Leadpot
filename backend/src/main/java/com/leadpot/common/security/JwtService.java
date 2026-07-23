package com.leadpot.common.security;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Service;

import com.leadpot.auth.User;
import com.leadpot.common.error.InvalidRefreshTokenException;

/**
 * JWT 발급/검증 서비스 (HMAC HS256).
 * - 액세스 토큰: 짧은 수명, 보호 API 접근용. token_type=access
 * - 리프레시 토큰: 긴 수명, 액세스 재발급용. token_type=refresh
 * 보호 API의 액세스 토큰 검증은 SecurityConfig 의 JwtDecoder(리소스 서버)가 담당하고,
 * 여기서는 발급과 "리프레시 토큰" 전용 파싱을 처리한다.
 */
@Service
public class JwtService {

    public static final String CLAIM_TOKEN_TYPE = "token_type";
    public static final String TYPE_ACCESS = "access";
    public static final String TYPE_REFRESH = "refresh";

    private final JwtEncoder encoder;
    private final NimbusJwtDecoder refreshDecoder;
    private final String issuer;
    private final long accessTtlSeconds;
    private final long refreshTtlSeconds;

    public JwtService(
            JwtEncoder encoder,
            SecretKey jwtSecretKey,
            @Value("${app.jwt.issuer}") String issuer,
            @Value("${app.jwt.access-ttl-seconds}") long accessTtlSeconds,
            @Value("${app.jwt.refresh-ttl-seconds}") long refreshTtlSeconds) {
        this.encoder = encoder;
        this.issuer = issuer;
        this.accessTtlSeconds = accessTtlSeconds;
        this.refreshTtlSeconds = refreshTtlSeconds;
        // 리프레시 토큰 전용 디코더: 서명/만료 + token_type=refresh 검증
        this.refreshDecoder = NimbusJwtDecoder.withSecretKey(jwtSecretKey)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
    }

    public long getAccessTtlSeconds() {
        return accessTtlSeconds;
    }

    /** 액세스 토큰 발급. */
    public String issueAccessToken(User user) {
        return issue(user, TYPE_ACCESS, accessTtlSeconds);
    }

    /** 리프레시 토큰 발급. */
    public String issueRefreshToken(User user) {
        return issue(user, TYPE_REFRESH, refreshTtlSeconds);
    }

    private String issue(User user, String tokenType, long ttlSeconds) {
        Instant now = Instant.now();
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .issuedAt(now)
                .expiresAt(now.plus(ttlSeconds, ChronoUnit.SECONDS))
                .subject(String.valueOf(user.getId()))
                .claim(CLAIM_TOKEN_TYPE, tokenType);
        if (TYPE_ACCESS.equals(tokenType)) {
            claims.claim("email", user.getEmail())
                    .claim("name", user.getName())
                    .claim("role", user.getRole().name());
        }
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims.build())).getTokenValue();
    }

    /**
     * 리프레시 토큰을 검증하고 사용자 id 를 반환한다.
     * 서명/만료가 유효하지 않거나 token_type 이 refresh 가 아니면 예외.
     */
    public Long parseRefreshTokenUserId(String refreshToken) {
        Jwt jwt;
        try {
            jwt = refreshDecoder.decode(refreshToken);
        } catch (JwtException e) {
            throw new InvalidRefreshTokenException("리프레시 토큰이 유효하지 않습니다.");
        }
        if (!TYPE_REFRESH.equals(jwt.getClaimAsString(CLAIM_TOKEN_TYPE))) {
            throw new InvalidRefreshTokenException("리프레시 토큰이 아닙니다.");
        }
        try {
            return Long.valueOf(jwt.getSubject());
        } catch (NumberFormatException e) {
            throw new InvalidRefreshTokenException("리프레시 토큰의 대상이 올바르지 않습니다.");
        }
    }
}
