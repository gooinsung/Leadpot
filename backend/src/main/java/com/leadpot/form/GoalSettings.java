package com.leadpot.form;

import java.time.LocalDate;
import java.util.Map;

/**
 * 리드폼 목표 설정(2026-08-09 사용자 요청) — "이 리드폼으로 일간 N개·월간 M개를
 * 시작일~종료일 동안 뽑겠다"를 선언하고, /goals 보고서로 달성률을 본다.
 *
 * <p>저장소는 {@code forms.settings_config}(JSONB) — 이전 기간(V32 마이그레이션 금지) 중이라
 * 자동 승인({@link AutoApproveSettings})과 같은 무스키마 패턴을 쓴다. 키:
 * {@code goalEnabled}(bool) · {@code goalDaily}(int) · {@code goalMonthly}(int) ·
 * {@code goalStart}/{@code goalEnd}(yyyy-MM-dd).
 *
 * <p>과금(grant.dailyGoal)과는 별개다 — 그쪽은 광고주 계약·문자 알림용, 이쪽은 마케터 운영 목표다.
 */
public record GoalSettings(boolean enabled, int daily, int monthly, LocalDate start, LocalDate end) {

    /** settings_config 에서 안전하게 판독. 값이 깨져 있으면 꺼진 것으로 본다(보고서가 죽으면 안 된다). */
    public static GoalSettings from(Map<String, Object> settings) {
        if (settings == null || !Boolean.TRUE.equals(settings.get("goalEnabled"))) {
            return new GoalSettings(false, 0, 0, null, null);
        }
        int daily = intOf(settings.get("goalDaily"));
        int monthly = intOf(settings.get("goalMonthly"));
        LocalDate start = dateOf(settings.get("goalStart"));
        LocalDate end = dateOf(settings.get("goalEnd"));
        // 기간이 없거나 뒤집혀 있으면 목표로 취급하지 않는다 — 보고서 기간 계산이 무의미해진다.
        if (start == null || end == null || end.isBefore(start) || (daily <= 0 && monthly <= 0)) {
            return new GoalSettings(false, 0, 0, null, null);
        }
        return new GoalSettings(true, daily, monthly, start, end);
    }

    /** 오늘(주어진 날짜)이 목표 기간 안인지. */
    public boolean activeOn(LocalDate today) {
        return enabled && !today.isBefore(start) && !today.isAfter(end);
    }

    private static int intOf(Object v) {
        if (v instanceof Number n) {
            return Math.max(0, n.intValue());
        }
        try {
            return v == null ? 0 : Math.max(0, Integer.parseInt(v.toString().trim()));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static LocalDate dateOf(Object v) {
        if (v == null) {
            return null;
        }
        try {
            return LocalDate.parse(v.toString().trim());
        } catch (RuntimeException e) {
            return null;
        }
    }
}
