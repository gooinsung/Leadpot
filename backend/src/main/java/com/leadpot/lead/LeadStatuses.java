package com.leadpot.lead;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * 리드 진행상태 — <b>마케터·광고주가 함께 쓰는 단일 축</b> (2026-08-08 사용자 확정, V29).
 *
 * <p>예전에는 마케터 축(신규/상담중/완료/불량)과 광고주 축(신규/확인/통화완료/부재/전환/종료)이
 * 분리돼 있었는데, 같은 리드를 두 사람이 다른 언어로 관리하게 되어 하나로 합쳤다.
 * 기존 값은 전부 신규로 리셋했고 옛 값은 {@code *_legacy} 컬럼에 백업만 남겼다(V29).
 *
 * <h3>고정 4개 + 커스텀</h3>
 * <ul>
 * <li>{@link #NEW} 신규 — 접수 직후 기본값.</li>
 * <li>{@link #VALID} 유효 — <b>과금 기준</b>. 이 상태로 들어오는 순간 광고주 잔액에서 DB 단가가
 *     차감되고, 빠져나가면 환급된다(AdvertiserBillingService). 자동 승인의 목표 상태이기도 하다.</li>
 * <li>{@link #AS_REQUESTED} AS요청 — 광고주가 사유·증빙과 함께 이의를 제기한 상태.
 *     <b>일반 상태 변경으로는 진입할 수 없고</b> AS 요청 플로우로만 만들어진다.
 *     마케터가 인정(→무효)/거부(→유효)로 해소한다.</li>
 * <li>{@link #INVALID} 무효 — 과금 제외. <b>넣는 것도 빼는 것도 마케터만</b> 할 수 있다(사용자 확정).</li>
 * <li>{@link #CUSTOM} — 광고주가 직접 만든 상태({@link CustomLeadStatus}). 상담중·부재중처럼
 *     본인 워크플로에 맞는 중간 상태다. 리드에는 {@code custom_status_id} 가 함께 저장된다.</li>
 * </ul>
 */
public final class LeadStatuses {

    public static final String NEW = "NEW";
    /** 유효 — 과금(차감) 기준 상태. */
    public static final String VALID = "VALID";
    /** AS요청 — AS 플로우로만 진입. */
    public static final String AS_REQUESTED = "AS_REQUESTED";
    /** 무효 — 마케터 전용(진입·해제 모두). */
    public static final String INVALID = "INVALID";
    /** 광고주 커스텀 상태. 리드의 custom_status_id 가 실제 정의를 가리킨다. */
    public static final String CUSTOM = "CUSTOM";

    /** 고정 상태의 화면 라벨(진행 순서 유지). CUSTOM 은 정의된 이름을 쓰므로 여기 없다. */
    public static final Map<String, String> FIXED_LABELS;

    static {
        Map<String, String> m = new LinkedHashMap<>();
        m.put(NEW, "신규");
        m.put(VALID, "유효");
        m.put(AS_REQUESTED, "AS요청");
        m.put(INVALID, "무효");
        FIXED_LABELS = Collections.unmodifiableMap(m);
    }

    /** 저장 가능한 status 컬럼 값 전부(고정 4 + CUSTOM). */
    public static final Set<String> ALL = Set.of(NEW, VALID, AS_REQUESTED, INVALID, CUSTOM);

    /** 광고주가 직접 지정할 수 있는 값. 무효는 마케터 전용, AS요청은 AS 플로우 전용이라 뺀다. */
    public static final Set<String> ADVERTISER_SETTABLE = Set.of(NEW, VALID, CUSTOM);

    /** 마케터가 일반 상태 변경으로 지정할 수 있는 값. AS요청만 플로우 전용이라 뺀다. */
    public static final Set<String> MARKETER_SETTABLE = Set.of(NEW, VALID, INVALID, CUSTOM);

    private LeadStatuses() {
    }

    /**
     * 화면·이력용 라벨. CUSTOM 은 정의 이름을 쓰고, 이름을 모르면(정의가 지워진 등) "사용자 상태"로.
     * 모르는 코드는 그대로 돌려준다 — 이력 문구가 깨지는 것보다 낫다.
     */
    public static String label(String status, String customName) {
        if (CUSTOM.equals(status)) {
            return customName == null || customName.isBlank() ? "사용자 상태" : customName;
        }
        return FIXED_LABELS.getOrDefault(status, status == null ? "신규" : status);
    }

    /**
     * 목록 필터·카운트에 쓰는 키. 고정 상태는 코드 그대로, 커스텀은 {@code C{id}} —
     * 커스텀끼리는 이름이 아니라 id 로 구분해야 한다(광고주가 이름을 바꿔도 필터가 유지된다).
     */
    public static String key(String status, Long customStatusId) {
        return CUSTOM.equals(status) && customStatusId != null ? "C" + customStatusId : status;
    }
}
