package com.leadpot.admin;

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

import com.leadpot.auth.Role;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.security.JwtService;

/**
 * 운영자(어드민) 경로 인가 검증.
 *
 * <p>세 방향을 다 막아야 한다:
 * <ol>
 * <li>마케터·광고주는 {@code /api/admin/**} 에 못 들어간다 — 여기가 뚫리면 <b>남의 계정 권한을 바꿀 수 있다</b>.</li>
 * <li>운영자는 마케터 API 에 못 들어간다(2026-08-05 변경) — 남의 고객 개인정보에 닿는 경로를 줄인다.</li>
 * <li>{@code /api/auth/me} 는 세 역할 공통이다.</li>
 * </ol>
 * 이 테스트가 깨지면 완화하지 말고 원인을 고칠 것.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminAccessControlTest {

    /** 운영자가 접근하면 안 되는 마케터 전용 API (대표 경로). */
    private static final String[] MARKETER_ONLY = {
            "/api/forms",
            "/api/leads?formId=1",
            "/api/landings",
            "/api/stats/overview",
            "/api/sms/status",
            "/api/advertisers"
    };

    /** 운영자만 접근할 수 있는 경로. */
    private static final String[] ADMIN_ONLY = {
            "/api/admin/users",
            "/api/admin/audit"
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
    private String adminToken;

    @BeforeEach
    void setUp() {
        User marketer = new User("admt-marketer@test.local", passwordEncoder.encode("pw12345678"), "마케터", null);
        marketer.setSubdomain("admt-marketer");
        userRepository.save(marketer);

        User advertiser = User.advertiser("admt-adv@test.local", passwordEncoder.encode("pw12345678"),
                "광고주", null, marketer.getId(), "테스트광고주㈜");
        userRepository.save(advertiser);

        User admin = new User("admt-admin@test.local", passwordEncoder.encode("pw12345678"), "운영자", null);
        admin.setSubdomain("admt-admin");
        admin.setRole(Role.ADMIN);
        userRepository.save(admin);

        marketerToken = jwtService.issueAccessToken(marketer);
        advertiserToken = jwtService.issueAccessToken(advertiser);
        adminToken = jwtService.issueAccessToken(admin);
    }

    @Test
    @DisplayName("마케터 토큰으로 어드민 API 를 부르면 403")
    void marketerCannotReachAdmin() throws Exception {
        for (String url : ADMIN_ONLY) {
            mockMvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, "Bearer " + marketerToken))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    @DisplayName("광고주 토큰으로 어드민 API 를 부르면 403")
    void advertiserCannotReachAdmin() throws Exception {
        for (String url : ADMIN_ONLY) {
            mockMvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, "Bearer " + advertiserToken))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    @DisplayName("토큰 없이 어드민 API 를 부르면 401")
    void anonymousCannotReachAdmin() throws Exception {
        for (String url : ADMIN_ONLY) {
            mockMvc.perform(get(url)).andExpect(status().isUnauthorized());
        }
    }

    @Test
    @DisplayName("운영자 토큰은 어드민 API 를 통과한다")
    void adminCanReachAdmin() throws Exception {
        for (String url : ADMIN_ONLY) {
            mockMvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                    .andExpect(status().isOk());
        }
    }

    @Test
    @DisplayName("운영자 토큰으로 마케터 전용 API 를 부르면 403 (2026-08-05 좁힘)")
    void adminCannotReachMarketerEndpoints() throws Exception {
        for (String url : MARKETER_ONLY) {
            mockMvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    @DisplayName("/api/auth/me 는 세 역할 모두 통과한다")
    void meIsSharedByAllRoles() throws Exception {
        for (String token : new String[] { marketerToken, advertiserToken, adminToken }) {
            mockMvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                    .andExpect(status().isOk());
        }
    }
}
