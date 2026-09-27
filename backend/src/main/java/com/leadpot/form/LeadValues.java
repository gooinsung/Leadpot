package com.leadpot.form;

import java.util.Map;

/**
 * 리드폼의 <b>리드당 가치</b>(원). 리드폼 {@code settingsConfig}(JSONB) 의 {@code leadValue} 키에 있다
 * (자동 승인 설정과 같은 자리 — 마이그레이션 없음, 공개 응답에서는 settingsConfig 째로 빠져 방문자에게 안 보인다).
 *
 * <p>리드가 접수되면 이 값을 리드({@code leads.lead_value}, V44)에 도장 찍는다 — 단가를 바꿔도 과거 수익은
 * 그대로다. 수익 = 기간 내 접수된 리드(상태 무관, 2026-09-27 사용자 확정)의 도장 값 합.
 */
public final class LeadValues {

    public static final String KEY = "leadValue";
    /** 방어 상한(1억 원) — 오타로 터무니없는 값이 들어오는 것만 막는다. */
    public static final long MAX = 100_000_000L;

    private LeadValues() {
    }

    /** 설정의 리드당 가치. 없거나 0 이하·숫자 아님이면 null. */
    public static Long of(Map<String, Object> settingsConfig) {
        if (settingsConfig == null) {
            return null;
        }
        Object raw = settingsConfig.get(KEY);
        long v;
        if (raw instanceof Number n) {
            v = n.longValue();
        } else if (raw != null) {
            String s = raw.toString().replaceAll("[,\\s원]", "");
            if (s.isEmpty()) {
                return null;
            }
            try {
                v = Long.parseLong(s);
            } catch (NumberFormatException e) {
                return null;
            }
        } else {
            return null;
        }
        return v > 0 ? Math.min(v, MAX) : null;
    }

    /** 수익 계산용 한 리드의 가치 — 도장 값이 있으면 그것, 없으면(기능 도입 전 리드) 폼의 현재 단가. */
    public static long effective(Long stamped, Long formCurrent) {
        if (stamped != null) {
            return stamped;
        }
        return formCurrent == null ? 0L : formCurrent;
    }
}
