package com.leadpot.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 유입 파라미터 위생 처리 검증.
 *
 * <p>핵심은 <b>허용 키만 남는다</b>는 것이다 — 제출·방문 기록은 공개 엔드포인트라
 * curl 로 임의 키를 넣을 수 있었고, 그러면 출처 필터 목록이 오염된다.
 * Spring 컨텍스트가 필요 없는 순수 단위 테스트다(빠르게 돌려야 하는 최종 관문).
 */
class TrackingParamsTest {

    @Test
    @DisplayName("표준 UTM 5개 + 광고 파라미터 3개는 그대로 저장된다")
    void keepsAllowedKeys() {
        Map<String, Object> raw = new LinkedHashMap<>();
        raw.put("source", "meta");
        raw.put("medium", "cpc");
        raw.put("campaign", "summer");
        raw.put("term", "대출");
        raw.put("content", "banner-a");
        raw.put("media_from", "danggun");
        raw.put("campaign_name", "test-campaign");
        raw.put("ads_name", "소재A");

        Map<String, Object> clean = TrackingParams.sanitize(raw);

        assertThat(clean).containsExactlyInAnyOrderEntriesOf(raw);
    }

    @Test
    @DisplayName("허용 목록에 없는 키는 버린다 — 필터 드롭다운 오염 방지")
    void dropsUnknownKeys() {
        Map<String, Object> raw = new LinkedHashMap<>();
        raw.put("media_from", "meta");
        raw.put("from", "danggun");        // 옛 아이디어의 키 — 지금은 허용하지 않는다
        raw.put("utm_source", "google");   // 접두어가 붙은 형태로 오면 저장하지 않는다
        raw.put("hacked", "x");
        raw.put("주민번호", "900101-1234567");

        Map<String, Object> clean = TrackingParams.sanitize(raw);

        assertThat(clean).containsOnlyKeys("media_from");
        assertThat(clean).containsEntry("media_from", "meta");
    }

    @Test
    @DisplayName("값이 200자를 넘으면 자른다 — referer·userAgent 와 같은 방식")
    void truncatesLongValues() {
        String long300 = "가".repeat(300);

        Map<String, Object> clean = TrackingParams.sanitize(Map.of("campaign_name", long300));

        assertThat((String) clean.get("campaign_name")).hasSize(200);
    }

    @Test
    @DisplayName("빈 값·공백만 있는 값은 저장하지 않는다 — 빈 칸이 필터 목록에 뜨지 않게")
    void dropsBlankValues() {
        Map<String, Object> raw = new LinkedHashMap<>();
        raw.put("media_from", "  meta  ");
        raw.put("ads_name", "   ");
        raw.put("campaign_name", "");

        Map<String, Object> clean = TrackingParams.sanitize(raw);

        assertThat(clean).containsExactly(Map.entry("media_from", "meta"));
    }

    @Test
    @DisplayName("남는 값이 없거나 입력이 비면 null — 컬럼을 비워 둔다")
    void returnsNullWhenNothingLeft() {
        assertThat(TrackingParams.sanitize(null)).isNull();
        assertThat(TrackingParams.sanitize(Map.of())).isNull();
        assertThat(TrackingParams.sanitize(Map.of("hacked", "x"))).isNull();
    }

    @Test
    @DisplayName("출력 순서는 허용 목록 순서로 고정된다 — URL 파라미터 순서와 무관하게 같은 표시")
    void outputOrderIsStable() {
        Map<String, Object> reversed = new LinkedHashMap<>();
        reversed.put("ads_name", "소재A");
        reversed.put("campaign_name", "캠페인");
        reversed.put("media_from", "meta");

        Map<String, Object> clean = TrackingParams.sanitize(reversed);

        assertThat(clean.keySet()).containsExactly("media_from", "campaign_name", "ads_name");
    }
}
