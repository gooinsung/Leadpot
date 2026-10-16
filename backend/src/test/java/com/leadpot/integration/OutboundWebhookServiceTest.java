package com.leadpot.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

/** 아웃바운드 웹훅 — '주소 + 상세주소' 항목을 주소·상세주소로 나눠 보내기. */
class OutboundWebhookServiceTest {

    private static Map<String, Object> answer(String value, String address, String detail) {
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("label", "주소");
        a.put("value", value);
        if (address != null) {
            a.put("address", address);
        }
        if (detail != null) {
            a.put("addressDetail", detail);
        }
        return a;
    }

    @Test
    void 부분을_고르면_따로_남긴_주소와_상세주소를_보낸다() {
        Map<String, Object> a = answer("(06234) 서울 강남구 테헤란로 123 101동 202호", "(06234) 서울 강남구 테헤란로 123", "101동 202호");
        assertThat(OutboundWebhookService.answerValue(a, "")).isEqualTo("(06234) 서울 강남구 테헤란로 123 101동 202호");
        assertThat(OutboundWebhookService.answerValue(a, "address")).isEqualTo("(06234) 서울 강남구 테헤란로 123");
        assertThat(OutboundWebhookService.answerValue(a, "detail")).isEqualTo("101동 202호");
    }

    @Test
    void 나눠_저장되기_전_리드는_주소에_전체_상세주소는_빈값() {
        Map<String, Object> a = answer("서울 강남구 테헤란로 123 101동 202호", null, null);
        assertThat(OutboundWebhookService.answerValue(a, "address")).isEqualTo("서울 강남구 테헤란로 123 101동 202호");
        assertThat(OutboundWebhookService.answerValue(a, "detail")).isEmpty();
    }

    @Test
    void 답변이_없으면_빈값() {
        assertThat(OutboundWebhookService.answerValue(null, "address")).isEmpty();
    }
}
