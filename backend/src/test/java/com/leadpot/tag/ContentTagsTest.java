package com.leadpot.tag;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

class ContentTagsTest {

    @Test
    void 공백_빈값_중복을_정리한다() {
        assertEquals(List.of("이사", "당근"), ContentTags.clean(Arrays.asList(" 이사 ", "", null, "당근", "이사")));
    }

    @Test
    void 비면_null() {
        assertNull(ContentTags.clean(List.of(" ", "")));
        assertNull(ContentTags.clean(null));
    }

    @Test
    void 길이와_개수를_자른다() {
        assertEquals("가".repeat(30), ContentTags.clean(List.of("가".repeat(40))).get(0));
        List<String> many = new ArrayList<>();
        for (int i = 0; i < 30; i++) many.add("t" + i);
        assertEquals(20, ContentTags.clean(many).size());
    }
}
