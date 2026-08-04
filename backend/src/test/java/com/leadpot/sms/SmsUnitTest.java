package com.leadpot.sms;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.leadpot.form.BlockType;
import com.leadpot.form.Form;
import com.leadpot.form.FormBlock;
import com.leadpot.form.FormType;
import com.leadpot.lead.Lead;

/** 문자 발송의 순수 로직 — 번호 정규화·과금 구분·템플릿 치환·수신번호 추론. */
class SmsUnitTest {

    private static Map<String, Object> answer(String varKey, String label, String value) {
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("varKey", varKey);
        a.put("label", label);
        a.put("value", value);
        return a;
    }

    private static Lead lead(Map<String, Object>... answers) {
        Lead l = new Lead();
        l.setAnswers(List.of(answers));
        return l;
    }

    @Nested
    @DisplayName("PhoneNumbers — 발송용 정규화")
    class Normalize {

        @Test
        void 하이픈을_제거한다() {
            assertEquals("01011112222", PhoneNumbers.normalize("010-1111-2222"));
        }

        @Test
        void 공백과_괄호도_제거한다() {
            assertEquals("0212345678", PhoneNumbers.normalize("(02) 1234 5678"));
        }

        @Test
        void 국가번호는_국내형식으로_바꾼다() {
            assertEquals("01011112222", PhoneNumbers.normalize("+82 10-1111-2222"));
            assertEquals("01011112222", PhoneNumbers.normalize("821011112222"));
        }

        @Test
        void 형식이_아니면_null() {
            assertNull(PhoneNumbers.normalize(null));
            assertNull(PhoneNumbers.normalize(""));
            assertNull(PhoneNumbers.normalize("이름"));
            assertNull(PhoneNumbers.normalize("1234"));            // 너무 짧다
            assertNull(PhoneNumbers.normalize("010111122223333")); // 너무 길다
            assertNull(PhoneNumbers.normalize("1588-0000"));       // 0 으로 시작하지 않는다
        }

        @Test
        void 마스킹은_뒤_4자리를_가린다() {
            assertEquals("0101111····", PhoneNumbers.mask("010-1111-2222"));
            assertEquals("", PhoneNumbers.mask(null));
        }
    }

    @Nested
    @DisplayName("SMS/LMS 과금 구분 — 90byte 기준")
    class Billing {

        @Test
        void 한글은_2바이트로_센다() {
            assertEquals(6, SolapiSmsSender.byteLength("가나다"));
            assertEquals(3, SolapiSmsSender.byteLength("abc"));
        }

        @Test
        void 한글_45자까지는_SMS() {
            assertEquals("SMS", SolapiSmsSender.channelOf("가".repeat(45)));
        }

        @Test
        void 한글_46자부터는_LMS() {
            assertEquals("LMS", SolapiSmsSender.channelOf("가".repeat(46)));
        }

        @Test
        void 빈_본문도_SMS() {
            assertEquals("SMS", SolapiSmsSender.channelOf(""));
            assertEquals(0, SolapiSmsSender.byteLength(null));
        }
    }

    @Nested
    @DisplayName("응답에서 messageId 추출")
    class Extract {

        @Test
        void 값을_찾아낸다() {
            assertEquals("M123", SolapiSmsSender.extract("{\"messageId\":\"M123\",\"to\":\"010\"}", "messageId"));
        }

        @Test
        void 없으면_null() {
            assertNull(SolapiSmsSender.extract("{\"to\":\"010\"}", "messageId"));
            assertNull(SolapiSmsSender.extract(null, "messageId"));
            assertNull(SolapiSmsSender.extract("{\"messageId\":null}", "messageId"));
        }
    }

    @Nested
    @DisplayName("TemplateRenderer — 변수 치환")
    class Render {

        private Form form() {
            return new Form(1L, "개인회생 상담", FormType.BASIC);
        }

        @Test
        void 변수키로_치환한다() {
            var r = TemplateRenderer.render("{{f1}} 님 안녕하세요.", form(),
                    lead(answer("f1", "이름", "홍길동")));
            assertEquals("홍길동 님 안녕하세요.", r.text());
            assertTrue(r.missing().isEmpty());
        }

        @Test
        void 항목명으로도_치환된다() {
            var r = TemplateRenderer.render("{{이름}} 님", form(), lead(answer("f1", "이름", "홍길동")));
            assertEquals("홍길동 님", r.text());
        }

        @Test
        void 시스템_변수를_치환한다() {
            var r = TemplateRenderer.render("{{form.name}} 접수", form(), lead(answer("f1", "이름", "홍길동")));
            assertEquals("개인회생 상담 접수", r.text());
        }

        @Test
        void 값이_비면_빈_문자열로_두고_알려준다() {
            var r = TemplateRenderer.render("{{f1}} / {{f9}}", form(), lead(answer("f1", "이름", "홍길동")));
            assertEquals("홍길동 / ", r.text());
            assertEquals(List.of("f9"), r.missing());
        }

        @Test
        void 치환값에_달러나_백슬래시가_있어도_깨지지_않는다() {
            var r = TemplateRenderer.render("{{f1}}", form(), lead(answer("f1", "메모", "$1 \\ 끝")));
            assertEquals("$1 \\ 끝", r.text());
        }

        @Test
        void 여러_변수를_한_본문에서_치환한다() {
            var r = TemplateRenderer.render("{{f1}} 님, {{f3}} 확인했습니다.", form(),
                    lead(answer("f1", "이름", "홍길동"), answer("f3", "채무금액", "3000만원")));
            assertEquals("홍길동 님, 3000만원 확인했습니다.", r.text());
        }

        @Test
        void 쓰인_변수_목록을_뽑는다() {
            assertEquals(java.util.Set.of("f1", "form.name"),
                    TemplateRenderer.usedVars("{{f1}} / {{form.name}} / {{f1}}"));
        }

        @Test
        void varKey_가_없는_과거_리드는_항목명으로_폴백한다() {
            Map<String, Object> old = new LinkedHashMap<>();
            old.put("label", "이름");
            old.put("value", "김일덩");
            Lead l = new Lead();
            l.setAnswers(List.of(old));
            assertEquals("김일덩", TemplateRenderer.answerValue(l, "이름"));
        }
    }

    @Nested
    @DisplayName("고객 수신번호 추론")
    class LeadPhone {

        /** leadPhone 은 저장소를 쓰지 않는 순수 계산이라 의존성 없이 검증한다. */
        private final LeadSmsPlanner planner = new LeadSmsPlanner(null, null, "https://app.lead-pot.com");

        private Form formWith(FormBlock... blocks) {
            Form f = new Form(1L, "상담", FormType.BASIC);
            f.replaceBlocks(List.of(blocks));
            return f;
        }

        private FormBlock field(String type, String label) {
            FormBlock b = new FormBlock();
            b.setBlockType(BlockType.FIELD);
            b.setFieldType(type);
            b.setLabel(label);
            return b;
        }

        @Test
        void 지정한_변수키에서_가져온다() {
            Form f = formWith(field("text", "이름"), field("tel", "연락처"));
            Lead l = lead(answer("f1", "이름", "홍길동"), answer("f2", "연락처", "010-1111-2222"));
            assertEquals("010-1111-2222", planner.leadPhone(f, l, "f2"));
        }

        @Test
        void 지정이_없으면_첫_연락처_항목을_찾는다() {
            Form f = formWith(field("text", "이름"), field("tel", "연락처"));
            Lead l = lead(answer("f1", "이름", "홍길동"), answer("f2", "연락처", "010-1111-2222"));
            assertEquals("010-1111-2222", planner.leadPhone(f, l, ""));
        }

        @Test
        void 연락처_항목이_없으면_빈_문자열() {
            Form f = formWith(field("text", "이름"));
            assertEquals("", planner.leadPhone(f, lead(answer("f1", "이름", "홍길동")), ""));
        }

        @Test
        void 연락처_항목이_있어도_값이_비면_빈_문자열() {
            Form f = formWith(field("tel", "연락처"));
            assertEquals("", planner.leadPhone(f, lead(answer("f1", "연락처", "")), ""));
        }
    }

    @Nested
    @DisplayName("SmsImages — MMS 첨부 규격(JPG·200KB) 맞추기")
    class Attachments {

        /** 압축이 잘 안 되도록 픽셀마다 색을 흩뿌린 이미지(단색이면 무조건 작아져 검증이 안 된다). */
        private static byte[] noisyPng(int w, int h) throws java.io.IOException {
            java.awt.image.BufferedImage img =
                    new java.awt.image.BufferedImage(w, h, java.awt.image.BufferedImage.TYPE_INT_RGB);
            java.util.Random rnd = new java.util.Random(42);
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    img.setRGB(x, y, rnd.nextInt(0xFFFFFF));
                }
            }
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(img, "png", out);
            return out.toByteArray();
        }

        @Test
        void 큰_PNG_를_200KB_이하_JPG_로_바꾼다() throws Exception {
            byte[] source = noisyPng(2400, 1800);
            assertTrue(source.length > SmsImages.MAX_BYTES, "원본이 규격보다 커야 의미 있는 검증이다");

            byte[] jpeg = SmsImages.toMmsJpeg(source);

            assertTrue(jpeg.length <= SmsImages.MAX_BYTES,
                    "변환 결과가 200KB 를 넘었다: " + jpeg.length);
            // JPEG 매직 넘버(FF D8) — 실제로 JPG 로 나갔는지 확인한다.
            assertEquals((byte) 0xFF, jpeg[0]);
            assertEquals((byte) 0xD8, jpeg[1]);
        }

        @Test
        void 이미_작은_이미지는_그대로_통과한다() throws Exception {
            byte[] jpeg = SmsImages.toMmsJpeg(noisyPng(200, 150));
            assertTrue(jpeg.length <= SmsImages.MAX_BYTES);
        }

        @Test
        void 이미지가_아니면_사유를_알려준다() {
            SmsImages.UnsupportedImageException e = org.junit.jupiter.api.Assertions.assertThrows(
                    SmsImages.UnsupportedImageException.class,
                    () -> SmsImages.toMmsJpeg("%PDF-1.4 not an image".getBytes()));
            assertTrue(e.getMessage().contains("JPG"), "형식 안내가 사유에 담겨야 한다: " + e.getMessage());
        }

        @Test
        void 빈_파일도_예외로_알린다() {
            org.junit.jupiter.api.Assertions.assertThrows(
                    SmsImages.UnsupportedImageException.class, () -> SmsImages.toMmsJpeg(new byte[0]));
        }
    }

    @Nested
    @DisplayName("첨부가 붙으면 MMS 로 과금된다")
    class MmsChannel {

        @Test
        void 첨부가_있으면_짧아도_MMS() {
            assertEquals("MMS", SolapiSmsSender.channelOf("짧은 문자", "FILE123"));
        }

        @Test
        void 첨부가_없으면_길이로_판정한다() {
            assertEquals("SMS", SolapiSmsSender.channelOf("짧은 문자", null));
            assertEquals("LMS", SolapiSmsSender.channelOf("가".repeat(46), "  "));
        }
    }
}
