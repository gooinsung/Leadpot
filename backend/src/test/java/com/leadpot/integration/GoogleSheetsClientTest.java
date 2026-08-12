package com.leadpot.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.google.api.services.sheets.v4.model.ValueRange;

/**
 * 구글시트 연동에서 네트워크 없이 검증할 수 있는 부분.
 *
 * <p>실제 시트 쓰기는 서비스 계정 키와 살아 있는 시트가 있어야 해서 여기서 다루지 않는다
 * (리드폼 편집 화면의 '시트 테스트 발송'이 그 역할).
 */
class GoogleSheetsClientTest {

    @Nested
    @DisplayName("시트 주소에서 ID 뽑기")
    class ExtractId {

        @Test
        @DisplayName("주소창을 통째로 붙여넣어도 ID 만 뽑는다")
        void 편집_주소에서_뽑는다() {
            assertThat(GoogleSheetsClient.extractSpreadsheetId(
                    "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit#gid=0"))
                    .isEqualTo("1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789");
        }

        @Test
        @DisplayName("쿼리스트링이 붙어도 ID 만 뽑는다")
        void 쿼리스트링이_있어도_뽑는다() {
            assertThat(GoogleSheetsClient.extractSpreadsheetId(
                    "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit?usp=sharing"))
                    .isEqualTo("1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789");
        }

        @Test
        @DisplayName("ID 를 그대로 넣으면 그대로 돌려준다")
        void ID_를_그대로_넣어도_된다() {
            assertThat(GoogleSheetsClient.extractSpreadsheetId("1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"))
                    .isEqualTo("1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789");
        }

        @Test
        @DisplayName("앞뒤 공백은 무시한다")
        void 공백은_무시한다() {
            assertThat(GoogleSheetsClient.extractSpreadsheetId("  1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789  "))
                    .isEqualTo("1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789");
        }

        @Test
        @DisplayName("시트 주소가 아니면 null — 엉뚱한 값으로 API 를 때리지 않는다")
        void 알아볼_수_없으면_null() {
            assertThat(GoogleSheetsClient.extractSpreadsheetId("https://example.com/hello")).isNull();
            assertThat(GoogleSheetsClient.extractSpreadsheetId("짧은값")).isNull();
            assertThat(GoogleSheetsClient.extractSpreadsheetId("")).isNull();
            assertThat(GoogleSheetsClient.extractSpreadsheetId(null)).isNull();
        }
    }

    @Nested
    @DisplayName("키 미설정 상태")
    class NotConfigured {

        private final GoogleSheetsClient client = new GoogleSheetsClient("");

        @Test
        @DisplayName("미설정이면 isConfigured 는 false, 이메일은 빈 문자열")
        void 미설정_상태를_알린다() {
            assertThat(client.isConfigured()).isFalse();
            assertThat(client.serviceAccountEmail()).isEmpty();
        }

        @Test
        @DisplayName("미설정이면 조용히 성공하지 않고 이유를 돌려준다")
        void 조용히_실패하지_않는다() {
            String err = client.appendRow("1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789", "",
                    List.of("접수일시"), List.of("2026-08-11 10:00"));

            assertThat(err).contains("GOOGLE_SHEETS_CREDENTIALS");
        }
    }

    @Nested
    @DisplayName("헤더 이름으로 열 맞추기")
    class ColumnPlan {

        /** 실제 사고 시트: 사용자가 A열에 'no' 를 삽입하고 오른쪽에 '특이사항'·'1차콜' 을 붙였다. */
        private final List<Object> 사용자시트헤더 = List.of(
                "no", "접수일시", "리드폼", "현재 채무 규모가 어떻게되나요?", "이름", "연락처", "특이사항", "1차콜");
        private final List<Object> 우리라벨 = List.of(
                "접수일시", "리드폼", "현재 채무 규모가 어떻게되나요?", "이름", "연락처");

        @Test
        @DisplayName("왼쪽에 사용자 열이 삽입돼도 이름이 같은 열을 찾아 쓴다(밀리지 않는다)")
        void 사용자가_앞에_열을_넣어도_안_밀린다() {
            GoogleSheetsClient.Layout layout =
                    GoogleSheetsClient.plan(사용자시트헤더, 우리라벨, 우리라벨.size());

            // 접수일시=B(1) … 연락처=F(5). A(no)·G(특이사항)·H(1차콜) 은 손대지 않는다.
            assertThat(layout.columns()).containsExactly(1, 2, 3, 4, 5);
            assertThat(layout.addedHeaders()).isEmpty();
        }

        @Test
        @DisplayName("사용자 열은 쓰기 범위에서 빠진다 — 손으로 채운 값을 덮지 않는다")
        void 사용자_열은_덮지_않는다() {
            GoogleSheetsClient.Layout layout =
                    GoogleSheetsClient.plan(사용자시트헤더, 우리라벨, 우리라벨.size());

            List<ValueRange> writes = layout.writes("리드", 6,
                    List.of("2026-08-12 15:38", "법률사무소 더엘", "2,000만원 이하", "김민희", "010-3864-0407"));

            assertThat(writes).hasSize(1);
            assertThat(writes.get(0).getRange()).isEqualTo("'리드'!B6:F6");
            assertThat(writes.get(0).getValues().get(0)).containsExactly(
                    "2026-08-12 15:38", "법률사무소 더엘", "2,000만원 이하", "김민희", "010-3864-0407");
        }

        @Test
        @DisplayName("열 순서를 바꿔놔도 이름대로 찾아가고, 사이에 낀 사용자 열은 범위에서 빠진다")
        void 열_순서가_바뀌어도_찾아간다() {
            // 연락처(A) · 메모(B, 사용자 열) · 접수일시(C) · 리드폼(D)
            List<Object> 뒤섞인헤더 = List.of("연락처", "메모", "접수일시", "리드폼");

            GoogleSheetsClient.Layout layout = GoogleSheetsClient.plan(
                    뒤섞인헤더, List.of("접수일시", "리드폼", "연락처"), 3);

            assertThat(layout.columns()).containsExactly(2, 3, 0);
            // B(메모)를 건너뛰려고 범위를 두 개로 쪼갠다.
            List<ValueRange> writes = layout.writes("", 10, List.of("일시", "폼", "010"));
            assertThat(writes).extracting(ValueRange::getRange)
                    .containsExactly("A10:A10", "C10:D10");
            assertThat(writes.get(0).getValues().get(0)).containsExactly("010");
            assertThat(writes.get(1).getValues().get(0)).containsExactly("일시", "폼");
        }

        @Test
        @DisplayName("헤더에 없는 새 문항은 오른쪽 끝에 열을 만들어 넣는다")
        void 새_문항은_오른쪽에_열을_만든다() {
            GoogleSheetsClient.Layout layout = GoogleSheetsClient.plan(
                    사용자시트헤더, List.of("접수일시", "리드폼", "이름", "연락처", "희망 상담시간"), 5);

            // 기존 헤더 폭이 8 이므로 새 열은 I(8).
            assertThat(layout.columns()).containsExactly(1, 2, 4, 5, 8);
            assertThat(layout.addedHeaders()).containsExactly("희망 상담시간");
            assertThat(layout.addedStart()).isEqualTo(8);

            List<ValueRange> writes = layout.writes("리드", 6,
                    List.of("일시", "폼", "홍길동", "010", "오후"));
            // 첫 쓰기는 새 열 이름을 1행에 넣는 것.
            assertThat(writes.get(0).getRange()).isEqualTo("'리드'!I1:I1");
            assertThat(writes).extracting(ValueRange::getRange)
                    .contains("'리드'!B6:C6", "'리드'!E6:F6", "'리드'!I6:I6");
        }

        @Test
        @DisplayName("빈 시트면 우리 헤더가 그대로 A열부터 자리를 잡는다")
        void 빈_시트는_A열부터() {
            GoogleSheetsClient.Layout layout =
                    GoogleSheetsClient.plan(우리라벨, 우리라벨, 우리라벨.size());

            assertThat(layout.columns()).containsExactly(0, 1, 2, 3, 4);
            assertThat(layout.addedHeaders()).isEmpty();
        }

        @Test
        @DisplayName("같은 이름의 열이 두 개면 앞의 것만 쓰고, 남은 값은 새 열로 뺀다")
        void 이름이_겹쳐도_한_열에_두_값을_넣지_않는다() {
            GoogleSheetsClient.Layout layout =
                    GoogleSheetsClient.plan(List.of("이름", "이름"), List.of("이름", "이름"), 2);

            assertThat(layout.columns()).containsExactly(0, 2);
            assertThat(layout.addedHeaders()).containsExactly("이름");
        }

        @Test
        @DisplayName("A1 이 비어 있어도 B열의 헤더 이름을 알아본다")
        void A1이_비어도_이름으로_찾는다() {
            List<Object> 헤더 = List.of("", "접수일시", "리드폼");

            assertThat(GoogleSheetsClient.plan(헤더, List.of("접수일시", "리드폼"), 2).columns())
                    .containsExactly(1, 2);
        }
    }

    @Nested
    @DisplayName("열 번호 → 알파벳")
    class ColumnLetter {

        @Test
        @DisplayName("A·Z·AA·AZ·BA 까지 맞다")
        void 스물여섯번째_이후도_맞다() {
            assertThat(GoogleSheetsClient.columnLetter(0)).isEqualTo("A");
            assertThat(GoogleSheetsClient.columnLetter(25)).isEqualTo("Z");
            assertThat(GoogleSheetsClient.columnLetter(26)).isEqualTo("AA");
            assertThat(GoogleSheetsClient.columnLetter(51)).isEqualTo("AZ");
            assertThat(GoogleSheetsClient.columnLetter(52)).isEqualTo("BA");
        }
    }

    @Test
    @DisplayName("시트 ID 를 알아볼 수 없으면 API 호출 전에 막는다")
    void 잘못된_시트값은_호출_전에_막힌다() {
        // 키가 있다고 가정해도(형식만 갖춘 값) ID 가 이상하면 네트워크로 나가지 않는다.
        GoogleSheetsClient client = new GoogleSheetsClient("{\"type\":\"service_account\"}");

        String err = client.appendRow("이건 시트 주소가 아니다", "", List.of("a"), List.of("b"));

        assertThat(err).contains("시트 ID");
    }
}
