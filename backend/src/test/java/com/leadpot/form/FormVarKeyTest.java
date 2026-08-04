package com.leadpot.form;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 리드폼 항목의 불변 변수키(`var_key`) 부여 규칙 — 순수 단위 테스트.
 *
 * 이 규칙이 깨지면 메시지 템플릿이 엉뚱한 항목의 값을 끼우게 되므로(docs/MESSAGING-PLAN.md §4)
 * 특히 "지운 키를 재사용하지 않는다"를 지킨다.
 */
class FormVarKeyTest {

    private static Form form() {
        return new Form(1L, "테스트 리드폼", FormType.BASIC);
    }

    private static FormBlock field(String label, String varKey) {
        FormBlock b = new FormBlock();
        b.setBlockType(BlockType.FIELD);
        b.setFieldType("text");
        b.setLabel(label);
        b.setVarKey(varKey);
        return b;
    }

    private static FormBlock choice(String question, String varKey) {
        FormBlock b = new FormBlock();
        b.setBlockType(BlockType.CHOICE);
        b.setContent(Map.of("question", question));
        b.setVarKey(varKey);
        return b;
    }

    private static FormBlock html() {
        FormBlock b = new FormBlock();
        b.setBlockType(BlockType.HTML);
        b.setContent(Map.of("html", "<p>안내</p>"));
        return b;
    }

    private static List<String> keys(Form f) {
        return f.getBlocks().stream().map(FormBlock::getVarKey).toList();
    }

    @Nested
    @DisplayName("최초 발급")
    class FirstAssign {

        @Test
        void 답변_항목에_순서대로_발급된다() {
            Form f = form();
            f.replaceBlocks(List.of(field("이름", null), field("연락처", null)));
            assertEquals(List.of("f1", "f2"), keys(f));
        }

        @Test
        void 콘텐츠_블록은_받지_않는다() {
            Form f = form();
            f.replaceBlocks(List.of(field("이름", null), html(), field("연락처", null)));
            assertEquals(java.util.Arrays.asList("f1", null, "f2"), keys(f)); // List.of 는 null 원소 불가
        }

        @Test
        void 스텝형_질문도_받는다() {
            Form f = form();
            f.replaceBlocks(List.of(choice("어디가 불편하신가요?", null), field("연락처", null)));
            assertEquals(List.of("f1", "f2"), keys(f));
        }
    }

    @Nested
    @DisplayName("재저장 시 유지")
    class Preserve {

        @Test
        void 그대로_다시_저장하면_키가_유지된다() {
            Form f = form();
            f.replaceBlocks(List.of(field("이름", null), field("연락처", null)));
            f.replaceBlocks(List.of(field("이름", "f1"), field("연락처", "f2")));
            assertEquals(List.of("f1", "f2"), keys(f));
        }

        @Test
        void 항목명을_바꿔도_키가_유지된다() {
            Form f = form();
            f.replaceBlocks(List.of(field("이름", null)));
            f.replaceBlocks(List.of(field("성명", "f1")));
            assertEquals(List.of("f1"), keys(f));
        }

        @Test
        void 순서를_바꿔도_키가_따라간다() {
            Form f = form();
            f.replaceBlocks(List.of(field("이름", null), field("연락처", null)));
            f.replaceBlocks(List.of(field("연락처", "f2"), field("이름", "f1")));
            assertEquals(List.of("f2", "f1"), keys(f));
        }
    }

    @Nested
    @DisplayName("지운 키는 재사용하지 않는다")
    class NoReuse {

        @Test
        void 마지막_항목을_지우고_새로_추가하면_다음_번호를_받는다() {
            Form f = form();
            f.replaceBlocks(List.of(field("이름", null), field("연락처", null))); // f1, f2
            f.replaceBlocks(List.of(field("이름", "f1")));                        // f2 삭제
            f.replaceBlocks(List.of(field("이름", "f1"), field("이메일", null)));  // 새 항목
            assertEquals(List.of("f1", "f3"), keys(f));
        }

        @Test
        void 중간_항목을_지우고_새로_추가해도_빈_번호를_메우지_않는다() {
            Form f = form();
            f.replaceBlocks(List.of(field("이름", null), field("연락처", null), field("이메일", null)));
            f.replaceBlocks(List.of(field("이름", "f1"), field("이메일", "f3"))); // f2 삭제
            f.replaceBlocks(List.of(field("이름", "f1"), field("이메일", "f3"), field("메모", null)));
            assertEquals(List.of("f1", "f3", "f4"), keys(f));
        }
    }

    @Nested
    @DisplayName("클라이언트가 보낸 키를 믿지 않는다")
    class Untrusted {

        @Test
        void 중복된_키를_보내면_하나만_살리고_새로_발급한다() {
            Form f = form();
            f.replaceBlocks(List.of(field("이름", "f1"), field("연락처", "f1")));
            List<String> ks = keys(f);
            assertEquals("f1", ks.get(0));
            assertNotEquals("f1", ks.get(1));
            assertEquals(2, ks.stream().distinct().count());
        }

        @Test
        void 형식이_틀린_키는_버리고_새로_발급한다() {
            Form f = form();
            f.replaceBlocks(List.of(field("이름", "이름"), field("연락처", "f0"), field("이메일", "")));
            for (String k : keys(f)) {
                assertTrue(k != null && k.matches("f[1-9][0-9]*"), "잘못된 키: " + k);
            }
            assertEquals(3, keys(f).stream().distinct().count());
        }

        @Test
        void 큰_번호를_보내면_카운터가_따라올라가_충돌하지_않는다() {
            Form f = form();
            f.replaceBlocks(List.of(field("이름", "f50")));
            f.replaceBlocks(List.of(field("이름", "f50"), field("연락처", null)));
            assertEquals(List.of("f50", "f51"), keys(f));
        }

        @Test
        void 콘텐츠_블록이_키를_보내도_지운다() {
            Form f = form();
            FormBlock h = html();
            h.setVarKey("f9");
            f.replaceBlocks(List.of(h));
            assertNull(f.getBlocks().get(0).getVarKey());
        }
    }

    /**
     * FormService.update 는 저장된 리드폼의 블록을 <b>clearBlocks() → flush → addBlocks()</b> 로
     * 나눠 교체한다(옛 행 DELETE 를 새 행 INSERT 보다 먼저 보내야 유니크 인덱스에 안 걸린다).
     * 이 분리가 변수키 결과를 바꾸지 않아야 한다.
     */
    @Nested
    @DisplayName("2단계 교체(clearBlocks → addBlocks)")
    class TwoStepReplace {

        @Test
        void 한번에_교체한_것과_결과가_같다() {
            Form once = form();
            once.replaceBlocks(List.of(field("이름", null), field("연락처", null)));

            Form staged = form();
            staged.clearBlocks();
            staged.addBlocks(List.of(field("이름", null), field("연락처", null)));

            assertEquals(keys(once), keys(staged));
        }

        @Test
        void 유지된_키는_그대로_두고_새_항목에만_발급한다() {
            Form f = form();
            f.replaceBlocks(List.of(field("이름", null), field("연락처", null))); // f1, f2
            f.clearBlocks();
            f.addBlocks(List.of(field("이름", "f1"), field("연락처", "f2"), field("이메일", null)));
            assertEquals(List.of("f1", "f2", "f3"), keys(f));
        }

        @Test
        void 비우지_않고_덧붙이면_기존_키와_겹치지_않는다() {
            Form f = form();
            f.replaceBlocks(List.of(field("이름", "f1")));
            f.addBlocks(List.of(field("연락처", "f1"))); // 이미 쓰인 키 → 새로 발급
            assertEquals(2, keys(f).stream().distinct().count());
            assertEquals("f1", keys(f).get(0));
        }
    }

    @Nested
    @DisplayName("answerLabel — 리드 답변의 항목명")
    class AnswerLabel {

        @Test
        void 입력항목은_label_스텝질문은_question() {
            assertEquals("이름", field("이름", null).answerLabel());
            assertEquals("어디가 불편하신가요?", choice("어디가 불편하신가요?", null).answerLabel());
        }

        @Test
        void 값이_없으면_빈_문자열() {
            assertEquals("", field(null, null).answerLabel());
            FormBlock c = new FormBlock();
            c.setBlockType(BlockType.CHOICE);
            assertEquals("", c.answerLabel());
        }
    }
}
