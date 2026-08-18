package com.leadpot.common;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 유입 추적 파라미터 위생 처리 — 리드·방문 기록에 저장하기 전 <b>최종 관문</b>.
 *
 * <p><b>왜 백엔드에 있어야 하나</b>: 프론트({@code lib/utm.ts})가 URL 에서 허용 키만 골라 보내지만
 * 제출·방문 기록 엔드포인트는 <b>공개</b>다({@code /api/public/**}). 프론트를 거치지 않고
 * <b>curl 한 줄로 임의의 키를 무제한 넣을 수 있었다</b> — 예전엔 {@code lead.setUtm(req.utm())} 이
 * 받은 map 을 그대로 JSONB 에 넣었다(키 개수·값 길이 제한 없음). 같은 이유로 회원가입도 서버에서
 * 막는다({@link com.leadpot.auth.AuthService} 주석 참고).
 *
 * <p>막지 않으면 아픈 곳은 두 군데다:
 * <ul>
 * <li><b>출처 필터 드롭다운 오염</b> — 파라미터 이름 목록이 쓰레기 키로 뒤덮이면 기능 자체를 못 쓴다.</li>
 * <li>저장 증폭 — 공개 엔드포인트에 큰 JSON 을 반복 POST 하면 JSONB 행이 계속 커진다.</li>
 * </ul>
 *
 * <p>같은 함수 안에서 {@code referer}·{@code userAgent} 는 {@code cut(.., 1024)} 로 잘랐는데
 * {@code utm} 만 빠져 있었다 — 그 일관성도 여기서 맞춘다.
 */
public final class TrackingParams {

    /**
     * 저장을 허용하는 키. 이 목록에 없는 키는 <b>조용히 버린다</b>(에러를 내지 않는다 —
     * 방문자가 URL 에 무엇을 붙였든 페이지는 정상 동작해야 한다).
     *
     * <p>앞 5개는 표준 UTM({@code utm_source} 등에서 접두어를 뗀 형태, 기존 데이터와 호환).
     * 뒤 3개는 광고 URL 빌더가 붙이는 자체 파라미터다 — 표준 UTM 과 이름이 겹치지 않게 골랐다.
     */
    public static final List<String> ALLOWED_KEYS = List.of(
            "source", "medium", "campaign", "term", "content",
            "media_from", "campaign_name", "ads_name");

    /** 값 길이 상한. 광고 매체·캠페인 이름에 200자를 넘길 이유가 없다. */
    private static final int MAX_VALUE_LENGTH = 200;

    private TrackingParams() {
    }

    /**
     * 허용 키만 남기고 값 길이를 자른다. 남는 게 없으면 {@code null}(컬럼을 비워 둔다).
     *
     * <p>출력 순서는 {@link #ALLOWED_KEYS} 순서로 고정한다 — 리드 상세·CSV 에서 항상 같은
     * 순서로 보이게 하려는 것이다(입력 순서를 따르면 URL 파라미터 순서에 따라 뒤바뀐다).
     */
    public static Map<String, Object> sanitize(Map<String, Object> raw) {
        if (raw == null || raw.isEmpty()) {
            return null;
        }
        Map<String, Object> clean = new LinkedHashMap<>();
        for (String key : ALLOWED_KEYS) {
            String value = normalize(raw.get(key));
            if (value != null) {
                clean.put(key, value);
            }
        }
        return clean.isEmpty() ? null : clean;
    }

    /** 문자열로 바꿔 trim·길이 제한. 빈 값은 저장하지 않는다(빈 칸이 필터 목록에 뜨지 않게). */
    private static String normalize(Object value) {
        if (value == null) {
            return null;
        }
        String s = value.toString().trim();
        if (s.isEmpty()) {
            return null;
        }
        return s.length() > MAX_VALUE_LENGTH ? s.substring(0, MAX_VALUE_LENGTH) : s;
    }
}
