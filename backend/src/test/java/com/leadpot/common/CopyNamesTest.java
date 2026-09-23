package com.leadpot.common;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/** 복사본 이름·JSON 깊은 복사 헬퍼 — 순수 단위 테스트. */
class CopyNamesTest {

    @Test
    void 이름_뒤에_복사본을_붙인다() {
        assertEquals("상담 신청 (복사본)", CopyNames.of("  상담 신청 "));
    }

    @Test
    void 너무_긴_이름은_원래_이름쪽을_잘라_한도를_지킨다() {
        String copy = CopyNames.of("가".repeat(300));
        assertEquals(CopyNames.MAX_LENGTH, copy.length());
        assertTrue(copy.endsWith(CopyNames.SUFFIX));
    }

    @Test
    void 중첩된_맵과_리스트를_공유하지_않는다() {
        Map<String, Object> inner = new java.util.LinkedHashMap<>(Map.of("a", 1));
        List<Object> items = new java.util.ArrayList<>(List.of(inner));
        Map<String, Object> src = new java.util.LinkedHashMap<>(Map.of("items", items, "s", "x"));

        Map<String, Object> copy = JsonCopies.map(src);
        inner.put("a", 2);
        items.add("추가");

        assertEquals(List.of(Map.of("a", 1)), copy.get("items"));
        assertEquals("x", copy.get("s"));
    }
}
