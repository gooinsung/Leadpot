package com.leadpot.form;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 리드폼의 <b>자동 승인 기간</b> 설정. 리드폼 {@code settingsConfig}(JSONB) 안의 세 키를 읽고 검증한다.
 *
 * <p><b>무엇을 하는 기능인가</b>: 켜 두면 접수된 리드가 지정한 일수만큼 방치됐을 때
 * 자동으로 상태를 <b>완료</b>로 넘긴다(대상: 신규·상담중).
 * 실행은 {@link com.leadpot.lead.LeadAutoApproveRunner}.
 *
 * <p><b>⚠️ {@code autoApproveSince} 가 이 설계의 핵심이다.</b> 사용자 결정(2026-08-06):
 * <b>이미 쌓여 있던 리드에는 소급 적용하지 않는다.</b> 기능을 켠 시점을 서버가 찍어두고
 * <b>그 시각 이후 접수된 리드만</b> 대상으로 삼는다. 이 값이 없으면 몇 달 묵은 리드 수백 건이
 * 켜는 순간 한꺼번에 완료로 뒤집히고, 되돌릴 방법이 없다.
 *
 * <p><b>클라이언트는 {@code autoApproveSince} 를 보내지 않는다</b> — 보내도 무시하고
 * {@link #stamp} 가 서버 시각으로 덮어쓴다. 브라우저가 과거 시각을 보내 소급 적용을 유발할 수 없어야 한다.
 *
 * <p>마이그레이션이 없는 이유: 동일 IP 차단 일수({@code ipDedupDays})·텔레그램 토글과 같은
 * {@code settings_config} JSONB 자리를 쓴다(V6).
 */
public record AutoApproveSettings(boolean enabled, int days, Instant since) {

    /** 기능 사용 여부(체크박스). */
    public static final String KEY_ENABLED = "autoApproveEnabled";
    /** 접수 후 며칠이 지나면 완료로 넘길지. */
    public static final String KEY_DAYS = "autoApproveDays";
    /** 기능을 켠 시각(서버가 찍는다). 이 시각 이후 접수된 리드만 대상. */
    public static final String KEY_SINCE = "autoApproveSince";

    /** 최소 1일. 0일(=접수 즉시 완료)은 사실상 상태 관리를 없애는 것이라 허용하지 않는다. */
    public static final int MIN_DAYS = 1;
    /** 상한 10년. 오타로 터무니없는 값이 들어오는 것만 막는 방어값이다. */
    public static final int MAX_DAYS = 3650;

    /** 꺼진 상태를 뜻하는 값. */
    public static final AutoApproveSettings OFF = new AutoApproveSettings(false, 0, null);

    /**
     * 리드폼 설정 맵에서 읽어온다. 값이 없거나 망가져 있으면 {@link #OFF} 로 본다 —
     * 판독 실패가 대량 상태변경으로 이어지면 안 되므로 <b>모르면 끈다</b>가 안전한 기본값이다.
     */
    public static AutoApproveSettings from(Map<String, Object> settings) {
        if (settings == null || !Boolean.TRUE.equals(settings.get(KEY_ENABLED))) {
            return OFF;
        }
        int days = intValue(settings.get(KEY_DAYS));
        Instant since = instantValue(settings.get(KEY_SINCE));
        if (days < MIN_DAYS || since == null) {
            return OFF;
        }
        return new AutoApproveSettings(true, Math.min(days, MAX_DAYS), since);
    }

    /** 실제로 자동 승인을 돌려야 하는 설정인지. */
    public boolean active() {
        return enabled && days >= MIN_DAYS && since != null;
    }

    /** 이 시각 이전에 접수된 리드가 대상이다(접수 후 {@link #days} 일 경과). */
    public Instant cutoff(Instant now) {
        return now.minus(days, ChronoUnit.DAYS);
    }

    /**
     * 저장 요청의 설정을 검증하고 {@link #KEY_SINCE} 를 확정한다. 리드폼을 저장할 때마다 거친다.
     *
     * <p>규칙
     * <ul>
     * <li><b>꺼져 있으면</b> {@code since} 를 지운다 — 다시 켤 때 옛 기준이 되살아나
     * 그동안 쌓인 리드가 소급 적용되는 일을 막는다(껐다 켜면 그 시점부터 새로 시작).</li>
     * <li><b>계속 켜져 있으면</b> 기존 {@code since} 를 유지한다 — 일수만 7 → 14 로 바꾼다고
     * 기준 시각이 초기화되면 안 된다.</li>
     * <li><b>새로 켜면</b> {@code now} 를 찍는다.</li>
     * <li><b>일수가 1 미만이면 강제로 끈다</b>(예외를 던지지 않는다). {@code sanitizeSmsSettings}
     * 와 같은 방식 — 저장이 실패해 편집 자체가 막히는 것보다, 꺼진 결과를 응답으로 돌려줘
     * 화면에서 바로 확인하게 하는 편이 낫다.</li>
     * </ul>
     *
     * @param previous 저장 전 리드폼의 설정(신규 리드폼이면 null)
     * @param incoming 저장 요청의 설정
     * @return {@code incoming} 의 복사본(원본을 고치지 않는다). {@code incoming} 이 null 이면 null.
     */
    public static Map<String, Object> stamp(Map<String, Object> previous, Map<String, Object> incoming,
            Instant now) {
        if (incoming == null) {
            return null;
        }
        Map<String, Object> copy = new LinkedHashMap<>(incoming);
        boolean wanted = Boolean.TRUE.equals(copy.get(KEY_ENABLED));
        int days = intValue(copy.get(KEY_DAYS));
        if (!wanted || days < MIN_DAYS) {
            copy.put(KEY_ENABLED, false);
            copy.remove(KEY_SINCE);
            return copy;
        }
        copy.put(KEY_DAYS, Math.min(days, MAX_DAYS));
        AutoApproveSettings before = from(previous);
        // 계속 켜져 있던 경우에만 기준 시각을 물려받는다.
        copy.put(KEY_SINCE, (before.active() ? before.since() : now).toString());
        return copy;
    }

    private static int intValue(Object o) {
        if (o instanceof Number n) {
            return n.intValue();
        }
        try {
            return o == null ? 0 : Integer.parseInt(o.toString().trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static Instant instantValue(Object o) {
        if (o instanceof Instant i) {
            return i;
        }
        if (o == null) {
            return null;
        }
        try {
            return Instant.parse(o.toString().trim());
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
