package com.leadpot.common.security;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.proc.SecurityContext;

/**
 * 인증/인가 설정 (Spring Security 7, stateless JWT).
 * - 공개: /api/health, /api/auth/**(가입·로그인·재발급), actuator
 * - 그 외 /api/** 는 유효한 액세스 토큰 필요 (OAuth2 Resource Server + HMAC HS256)
 * - CORS 는 여기서 일괄 관리(app.cors.allowed-origins). 비밀번호는 BCrypt(delegating).
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final String[] allowedOrigins;
    private final String jwtSecret;
    private final String issuer;

    public SecurityConfig(
            @Value("${app.cors.allowed-origins}") String[] allowedOrigins,
            @Value("${app.jwt.secret}") String jwtSecret,
            @Value("${app.jwt.issuer}") String issuer) {
        this.allowedOrigins = allowedOrigins;
        this.jwtSecret = jwtSecret;
        this.issuer = issuer;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/health").permitAll()
                        .requestMatchers("/api/auth/signup", "/api/auth/login", "/api/auth/refresh").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                        .requestMatchers("/api/public/**").permitAll()
                        .requestMatchers("/uploads/**").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    /** JWT 서명/검증에 사용하는 대칭키(HMAC HS256). */
    @Bean
    public SecretKey jwtSecretKey() {
        byte[] bytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException(
                    "app.jwt.secret 는 HS256 을 위해 최소 32바이트(256비트) 이상이어야 합니다. 현재 " + bytes.length + "바이트.");
        }
        return new SecretKeySpec(bytes, "HmacSHA256");
    }

    @Bean
    public JwtEncoder jwtEncoder(SecretKey jwtSecretKey) {
        return new NimbusJwtEncoder(new ImmutableSecret<SecurityContext>(jwtSecretKey));
    }

    /** 보호 API 용 액세스 토큰 디코더: 서명/만료/발급자 + token_type=access 검증. */
    @Bean
    public JwtDecoder jwtDecoder(SecretKey jwtSecretKey) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(jwtSecretKey)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();

        OAuth2TokenValidator<Jwt> defaults = JwtValidators.createDefaultWithIssuer(issuer);
        OAuth2TokenValidator<Jwt> accessTypeOnly = jwt -> JwtService.TYPE_ACCESS
                .equals(jwt.getClaimAsString(JwtService.CLAIM_TOKEN_TYPE))
                        ? OAuth2TokenValidatorResult.success()
                        : OAuth2TokenValidatorResult.failure(
                                new OAuth2Error("invalid_token", "액세스 토큰이 아닙니다.", null));
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(defaults, accessTypeOnly));
        return decoder;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        // 설정된 오리진 + 서브도메인 공개 페이지(로컬 *.localhost). 배포 시 APP_CORS_ALLOWED_ORIGINS 에
        // https://*.도메인 패턴을 추가하면 운영 서브도메인도 허용된다. (allowedOriginPatterns 는 와일드카드 지원)
        List<String> originPatterns = new ArrayList<>(Arrays.asList(allowedOrigins));
        originPatterns.add("http://*.localhost:5173");
        config.setAllowedOriginPatterns(originPatterns);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        // 공개 API(/api/public/**)는 외부 사이트 임베드(M6)에서 호출되므로 모든 오리진 허용.
        // 인증/쿠키를 쓰지 않는 공개 엔드포인트라 credentials 는 끈다(폼 조회·리드 제출·방문 기록).
        CorsConfiguration publicConfig = new CorsConfiguration();
        publicConfig.setAllowedOriginPatterns(List.of("*"));
        publicConfig.setAllowedMethods(List.of("GET", "POST", "OPTIONS"));
        publicConfig.setAllowedHeaders(List.of("*"));
        publicConfig.setAllowCredentials(false);
        publicConfig.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        // 더 구체적인 경로(/api/public/**)가 /api/** 보다 우선 매칭된다.
        source.registerCorsConfiguration("/api/public/**", publicConfig);
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
