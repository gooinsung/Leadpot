package com.leadpot.advertiser;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;

/**
 * 광고주 로그인 경로 + 감사 로그 기록 검증.
 * <p>
 * ⚠️ 이 테스트는 <b>의도적으로 {@code @Transactional} 을 붙이지 않는다.</b>
 * 테스트가 트랜잭션을 열면 {@code AuthService.login} 의 {@code readOnly=true} 가 무력화되어
 * 실제 운영 경로를 재현하지 못한다. 실제로 감사 로그 INSERT 가 로그인의 read-only 트랜잭션에
 * 끼어들어 <b>로그인이 401 로 깨지는 버그</b>가 있었고, 트랜잭션 테스트로는 잡히지 않았다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AdvertiserLoginAuditTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private AdvertiserAccessLogRepository logRepository;

    @Test
    @DisplayName("광고주 로그인이 성공하고 LOGIN 감사 로그가 남는다 (read-only 트랜잭션 회귀 방지)")
    void advertiserLoginSucceedsAndIsAudited() throws Exception {
        User marketer = new User("audit-m@test.local", passwordEncoder.encode("pw12345678"), "마케터", null);
        marketer.setSubdomain("audit-m");
        userRepository.save(marketer);

        User advertiser = userRepository.save(User.advertiser("audit-a@test.local",
                passwordEncoder.encode("pw12345678"), "광고주", null, marketer.getId(), "회사"));

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"audit-a@test.local\",\"password\":\"pw12345678\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.role").value("ADVERTISER"))
                .andExpect(jsonPath("$.accessToken").isNotEmpty());

        assertThat(logRepository.findByAdvertiserIdOrderByCreatedAtDesc(advertiser.getId(), PageRequest.of(0, 10)))
                .anySatisfy(entry -> assertThat(entry.getAction()).isEqualTo(AdvertiserAccessLog.ACTION_LOGIN));

        assertThat(logRepository.findLastLoginAt(advertiser.getId())).isNotNull();
    }

    @Test
    @DisplayName("마케터 로그인은 감사 로그를 남기지 않는다")
    void marketerLoginIsNotAudited() throws Exception {
        User marketer = new User("audit-m2@test.local", passwordEncoder.encode("pw12345678"), "마케터", null);
        marketer.setSubdomain("audit-m2");
        userRepository.save(marketer);

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"audit-m2@test.local\",\"password\":\"pw12345678\"}"))
                .andExpect(status().isOk());

        assertThat(logRepository.findLastLoginAt(marketer.getId())).isNull();
    }

    @Test
    @DisplayName("정지된 광고주는 로그인할 수 없다(401)")
    void inactiveAdvertiserCannotLogin() throws Exception {
        User marketer = new User("audit-m3@test.local", passwordEncoder.encode("pw12345678"), "마케터", null);
        marketer.setSubdomain("audit-m3");
        userRepository.save(marketer);

        User advertiser = User.advertiser("audit-a3@test.local", passwordEncoder.encode("pw12345678"),
                "광고주", null, marketer.getId(), "회사");
        advertiser.setActive(false);
        userRepository.save(advertiser);

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"audit-a3@test.local\",\"password\":\"pw12345678\"}"))
                .andExpect(status().isUnauthorized());
    }
}
