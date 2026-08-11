package com.leadpot.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

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

    @Test
    @DisplayName("시트 ID 를 알아볼 수 없으면 API 호출 전에 막는다")
    void 잘못된_시트값은_호출_전에_막힌다() {
        // 키가 있다고 가정해도(형식만 갖춘 값) ID 가 이상하면 네트워크로 나가지 않는다.
        GoogleSheetsClient client = new GoogleSheetsClient("{\"type\":\"service_account\"}");

        String err = client.appendRow("이건 시트 주소가 아니다", "", List.of("a"), List.of("b"));

        assertThat(err).contains("시트 ID");
    }
}
