package com.leadpot.landing.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

class LandingSummaryTest {

    @Test
    void FORM_블록의_formId만_중복없이_뽑는다() {
        Map<String, Object> nullForm = new HashMap<>();
        nullForm.put("type", "FORM");
        nullForm.put("formId", null);
        List<Map<String, Object>> content = List.of(
                Map.of("type", "IMAGE", "url", "x"),
                Map.of("type", "FORM", "formId", 7, "trigger", "inline"),
                Map.of("type", "EMBED", "html", "<iframe>"),
                Map.of("type", "FORM", "formId", 7L, "trigger", "overlay"),
                Map.of("type", "FORM", "formId", "12"),
                nullForm);

        assertThat(LandingSummary.formIdsOf(content)).containsExactly(7L, 12L);
    }

    @Test
    void content가_없으면_빈_목록() {
        assertThat(LandingSummary.formIdsOf(null)).isEmpty();
    }
}
