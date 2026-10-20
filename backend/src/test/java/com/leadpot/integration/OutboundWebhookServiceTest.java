package com.leadpot.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/** 아웃바운드 웹훅 — '주소 + 상세주소'·'라디오 묶음' 항목을 나눠 보내기. */
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
        assertThat(OutboundWebhookService.answerValue(a, "", "")).isEqualTo("(06234) 서울 강남구 테헤란로 123 101동 202호");
        assertThat(OutboundWebhookService.answerValue(a, "address", "")).isEqualTo("(06234) 서울 강남구 테헤란로 123");
        assertThat(OutboundWebhookService.answerValue(a, "detail", "")).isEqualTo("101동 202호");
    }

    @Test
    void 나눠_저장되기_전_리드는_주소에_전체_상세주소는_빈값() {
        Map<String, Object> a = answer("서울 강남구 테헤란로 123 101동 202호", null, null);
        assertThat(OutboundWebhookService.answerValue(a, "address", "")).isEqualTo("서울 강남구 테헤란로 123 101동 202호");
        assertThat(OutboundWebhookService.answerValue(a, "detail", "")).isEmpty();
    }

    @Test
    void 답변이_없으면_빈값() {
        assertThat(OutboundWebhookService.answerValue(null, "address", "")).isEmpty();
    }

    @Test
    void 라디오_묶음은_행별_답을_보낸다() {
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("value", "입주 청소: 희망 / 인터넷 가입: 필요 없음");
        a.put("groupAnswers", List.of("희망", "필요 없음"));
        assertThat(OutboundWebhookService.answerValue(a, "row:0", "입주 청소")).isEqualTo("희망");
        assertThat(OutboundWebhookService.answerValue(a, "row:1", "")).isEqualTo("필요 없음");
        assertThat(OutboundWebhookService.answerValue(a, "row:5", "")).isEmpty();
    }

    @Test
    void 행별_답이_없는_옛_리드는_질문명으로_찾는다() {
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("value", "입주 청소(청소업체 연결 희망): 희망 / 인터넷 가입(통신사 이동 등): 필요 없음");
        assertThat(OutboundWebhookService.answerValue(a, "row:1", "인터넷 가입(통신사 이동 등)")).isEqualTo("필요 없음");
        assertThat(OutboundWebhookService.answerValue(a, "row:0", "없는 질문")).isEmpty();
    }

    @Test
    void 주소_조각을_직접_조합해_보낸다() {
        Map<String, Object> a = answer("(06234) 서울 강남구 테헤란로 123 (역삼동, 래미안) 101동 202호", null, null);
        Map<String, Object> parts = new LinkedHashMap<>();
        parts.put("zonecode", "06234");
        parts.put("road", "서울 강남구 테헤란로 123");
        parts.put("jibun", "서울 강남구 역삼동 737");
        parts.put("building", "래미안");
        parts.put("bname", "역삼동");
        parts.put("detail", "101동 202호");
        a.put("addressParts", parts);
        assertThat(OutboundWebhookService.addressTemplateValue(a, "{우편번호} {지번} {상세주소}"))
                .isEqualTo("06234 서울 강남구 역삼동 737 101동 202호");
        assertThat(OutboundWebhookService.addressTemplateValue(a, "[{우편번호}] {도로명} ({건물명})"))
                .isEqualTo("[06234] 서울 강남구 테헤란로 123 (래미안)");
    }

    @Test
    void 빈_조각은_겹친_공백_없이_빠진다() {
        Map<String, Object> a = answer("(06234) 서울 강남구 테헤란로 123", null, null);
        Map<String, Object> parts = new LinkedHashMap<>();
        parts.put("zonecode", "06234");
        parts.put("road", "서울 강남구 테헤란로 123");
        parts.put("jibun", "");
        parts.put("detail", "");
        a.put("addressParts", parts);
        assertThat(OutboundWebhookService.addressTemplateValue(a, "{우편번호} {상세주소} {도로명}"))
                .isEqualTo("06234 서울 강남구 테헤란로 123");
    }

    @Test
    void 조각이_없는_옛_리드는_우편번호만_떼고_나머지를_주소_자리에() {
        Map<String, Object> a = answer("(06234) 서울 강남구 테헤란로 123 101동", "(06234) 서울 강남구 테헤란로 123", "101동");
        assertThat(OutboundWebhookService.addressTemplateValue(a, "{우편번호}|{지번}|{상세주소}"))
                .isEqualTo("06234|서울 강남구 테헤란로 123|101동");
    }
}
