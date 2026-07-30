package com.leadpot.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.common.security.JwtService;

/**
 * 광고주 하위계정의 경로 인가 검증 (A1 핵심 보장).
 * <p>
 * 광고주는 {@code /api/advertiser/**} 만 접근할 수 있고 마케터 API 는 전부 차단돼야 한다.
 * 이 테스트가 깨지면 <b>리드(개인정보)가 권한 없는 계정에 노출될 수 있다</b>는 뜻이므로
 * 절대 완화하지 말고 원인을 고칠 것.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdvertiserAccessControlTest {

    /** 광고주가 접근하면 안 되는 마케터 전용 API (대표 경로). */
    private static final String[] MARKETER_ONLY_ENDPOINTS = {
            "/api/forms",
            "/api/leads?formId=1",
            "/api/leads/count",
            "/api/landings",
            "/api/consent-documents",
            "/api/html-components",
            "/api/integrations",
            "/api/stats/overview",
            "/api/advertisers"
    };

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private String marketerToken;
    private String advertiserToken;

    @BeforeEach
    void setUp() {
        User marketer = new User("marketer@test.local", passwordEncoder.encode("pw12345678"), "마케터", null);
        marketer.setSubdomain("marketer-test");
        userRepository.save(marketer);

        User advertiser = User.advertiser("advertiser@test.local", passwordEncoder.encode("pw12345678"),
                "광고주", null, marketer.getId(), "테스트광고주㈜");
        userRepository.save(advertiser);

        marketerToken = jwtService.issueAccessToken(marketer);
        advertiserToken = jwtService.issueAccessToken(advertiser);
    }

    @Test
    @DisplayName("광고주 토큰으로 마케터 전용 API 를 호출하면 전부 403")
    void advertiserIsForbiddenOnMarketerEndpoints() throws Exception {
        for (String endpoint : MARKETER_ONLY_ENDPOINTS) {
            mockMvc.perform(get(endpoint).header(HttpHeaders.AUTHORIZATION, bearer(advertiserToken)))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    @DisplayName("마케터 토큰은 마케터 API 에서 403 이 아니다(권한 규칙이 과하게 막지 않는지 회귀 확인)")
    void marketerIsNotForbiddenOnOwnEndpoints() throws Exception {
        mockMvc.perform(get("/api/forms").header(HttpHeaders.AUTHORIZATION, bearer(marketerToken)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/landings").header(HttpHeaders.AUTHORIZATION, bearer(marketerToken)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("/api/auth/me 는 마케터·광고주 공통으로 접근 가능")
    void bothRolesCanReadOwnProfile() throws Exception {
        mockMvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, bearer(marketerToken)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, bearer(advertiserToken)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("마케터는 광고주 전용 영역(/api/advertiser/**)에 접근할 수 없다")
    void marketerIsForbiddenOnAdvertiserArea() throws Exception {
        mockMvc.perform(get("/api/advertiser/leads").header(HttpHeaders.AUTHORIZATION, bearer(marketerToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("광고주는 서브도메인을 변경할 수 없다(공개 페이지가 없는 계정)")
    void advertiserCannotChangeSubdomain() throws Exception {
        mockMvc.perform(get("/api/auth/subdomain").header(HttpHeaders.AUTHORIZATION, bearer(advertiserToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("토큰 없이 호출하면 401(인증 실패와 인가 실패가 구분되는지)")
    void anonymousIsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/forms")).andExpect(status().isUnauthorized());
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }
}
