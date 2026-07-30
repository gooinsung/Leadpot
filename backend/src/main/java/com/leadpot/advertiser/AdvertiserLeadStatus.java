package com.leadpot.advertiser;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * 광고주 관점의 리드 처리 상태 (사용자 확정: 고정 6개).
 * <p>
 * 마케터의 상태(NEW/IN_PROGRESS/DONE/SPAM)와는 <b>별개 축</b>이다.
 * 특히 'SPAM(불량)' 판정은 마케터 고유 권한이라 광고주 상태값에는 없다.
 * <p>
 * {@link #CONVERTED}(전환)는 <b>실제로 판매가 성사된</b> 리드다. 광고 성과 측정의 최종 지표이므로
 * '통화완료'와 반드시 구분한다(통화는 했지만 안 산 경우가 대부분).
 */
public final class AdvertiserLeadStatus {

    public static final String NEW = "NEW";
    public static final String CONFIRMED = "CONFIRMED";
    public static final String CALLED = "CALLED";
    public static final String NO_ANSWER = "NO_ANSWER";
    /** 전환 — 실제 판매(계약) 성사. */
    public static final String CONVERTED = "CONVERTED";
    public static final String CLOSED = "CLOSED";

    /** 화면 표시용 라벨. 진행 순서대로 유지한다(LinkedHashMap → 순서 보존 복사). */
    public static final Map<String, String> LABELS;

    static {
        Map<String, String> m = new LinkedHashMap<>();
        m.put(NEW, "신규");
        m.put(CONFIRMED, "확인");
        m.put(CALLED, "통화완료");
        m.put(NO_ANSWER, "부재");
        m.put(CONVERTED, "전환");
        m.put(CLOSED, "종료");
        LABELS = Collections.unmodifiableMap(m);
    }

    public static final Set<String> VALUES = LABELS.keySet();

    private AdvertiserLeadStatus() {
    }

    public static boolean isValid(String status) {
        return status != null && VALUES.contains(status);
    }

    public static String label(String status) {
        return LABELS.getOrDefault(status, status == null ? "신규" : status);
    }
}
