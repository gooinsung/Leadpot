package com.leadpot.advertiser;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * 광고주 관점의 리드 처리 상태 (사용자 확정 2026-07-30: 고정 5개).
 * <p>
 * 마케터의 상태(NEW/IN_PROGRESS/DONE/SPAM)와는 <b>별개 축</b>이다.
 * 특히 'SPAM(불량)' 판정은 마케터 고유 권한이라 광고주 상태값에는 없다.
 */
public final class AdvertiserLeadStatus {

    public static final String NEW = "NEW";
    public static final String CONFIRMED = "CONFIRMED";
    public static final String CALLED = "CALLED";
    public static final String NO_ANSWER = "NO_ANSWER";
    public static final String CLOSED = "CLOSED";

    /** 화면 표시용 라벨(순서 유지). */
    public static final Map<String, String> LABELS;

    static {
        Map<String, String> m = new LinkedHashMap<>();
        m.put(NEW, "신규");
        m.put(CONFIRMED, "확인");
        m.put(CALLED, "통화완료");
        m.put(NO_ANSWER, "부재");
        m.put(CLOSED, "종료");
        LABELS = Map.copyOf(m);
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
