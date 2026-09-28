package com.leadpot.lead;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AddressPartsTest {

    @Test
    void 우편번호와_주소를_나눈다() {
        assertThat(AddressParts.split("(06234) 서울 강남구 테헤란로 123 (역삼동, 래미안)"))
                .containsExactly("06234", "서울 강남구 테헤란로 123 (역삼동, 래미안)");
    }

    @Test
    void 형식이_아니면_우편번호는_비우고_값_전체를_주소로() {
        assertThat(AddressParts.split("서울 강남구")).containsExactly("", "서울 강남구");
        assertThat(AddressParts.split(null)).containsExactly("", "");
    }

    @Test
    void 주소_유형_답변에만_키를_채운다() {
        List<Map<String, Object>> out = AddressParts.stamp(List.of(
                Map.of("label", "주소", "fieldType", "address", "value", "(06234) 서울 강남구 테헤란로 123"),
                Map.of("label", "이름", "fieldType", "text", "value", "(홍) 길동")));
        assertThat(out.get(0)).containsEntry("zonecode", "06234").containsEntry("address", "서울 강남구 테헤란로 123")
                .containsEntry("value", "(06234) 서울 강남구 테헤란로 123");
        assertThat(out.get(1)).doesNotContainKeys("zonecode", "address");
    }

    @Test
    void 저장된_키가_없으면_값을_쪼개서_준다() {
        Map<String, Object> old = Map.of("value", "(06234) 서울 강남구");
        assertThat(AddressParts.part(old, "zonecode")).isEqualTo("06234");
        assertThat(AddressParts.part(old, "address")).isEqualTo("서울 강남구");
        assertThat(AddressParts.part(old, "")).isEqualTo("(06234) 서울 강남구");
    }

    @Test
    void 저장된_키를_먼저_쓴다() {
        Map<String, Object> a = Map.of("value", "(06234) 서울", "zonecode", "11111", "address", "부산");
        assertThat(AddressParts.part(a, "zonecode")).isEqualTo("11111");
        assertThat(AddressParts.part(a, "address")).isEqualTo("부산");
    }
}
