package com.leadpot.common.upload;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import jakarta.servlet.FilterChain;

class LegacyImageUrlFilterTest {

    private static final String OLD = "https://pub-abc.r2.dev";
    private static final String NEW = "https://img.lead-pot.com";
    private static final String BODY =
            "{\"content\":[{\"type\":\"IMAGE\",\"url\":\"" + OLD + "/landing-image/a.png\"},"
                    + "{\"type\":\"HTML\",\"html\":\"<img src='" + OLD + "/b.jpg'>\"}]}";

    private MockHttpServletResponse run(LegacyImageUrlFilter filter, String method, String uri) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest(method, uri);
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = (rq, rs) -> {
            rs.setContentType("application/json");
            rs.getOutputStream().write(BODY.getBytes(StandardCharsets.UTF_8));
        };
        filter.doFilter(req, res, chain);
        return res;
    }

    @Test
    void 공개_랜딩_응답의_옛_r2dev_주소를_새_도메인으로_바꾼다() throws Exception {
        MockHttpServletResponse res = run(new LegacyImageUrlFilter(OLD + "/", NEW), "GET", "/api/public/sites/balis/37");
        String body = res.getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).doesNotContain(OLD).contains(NEW + "/landing-image/a.png").contains(NEW + "/b.jpg");
        assertThat(res.getContentLength()).isEqualTo(body.getBytes(StandardCharsets.UTF_8).length);
    }

    @Test
    void 공개_리드폼_응답도_바꾼다() throws Exception {
        MockHttpServletResponse res = run(new LegacyImageUrlFilter(OLD, NEW), "GET", "/api/public/forms/5");
        assertThat(res.getContentAsString(StandardCharsets.UTF_8)).doesNotContain(OLD);
    }

    @Test
    void 관리_API_와_설정이_비었을_때는_건드리지_않는다() throws Exception {
        assertThat(run(new LegacyImageUrlFilter(OLD, NEW), "GET", "/api/landings/37")
                .getContentAsString(StandardCharsets.UTF_8)).isEqualTo(BODY);
        assertThat(run(new LegacyImageUrlFilter("", NEW), "GET", "/api/public/sites/balis/37")
                .getContentAsString(StandardCharsets.UTF_8)).isEqualTo(BODY);
    }
}
