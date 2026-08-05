package com.leadpot.sms;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import com.leadpot.auth.User;

/**
 * 계정별 문자 발송 권한 판정 (V25).
 *
 * <p>문자는 <b>리드팟 솔라피 계정 하나로 나가고 비용을 우리가 부담</b>한다
 * (docs/MESSAGING-PLAN.md §11). 그래서 계정마다 ① 발송 자체 on/off ② 허용 채널 ③ 월 상한
 * 세 가지를 따로 통제한다. 전부 기본 off 다.
 *
 * <p><b>⚠️ 월 상한의 0 은 '금지'다.</b> 제거된 플랜 상수({@code app.sms.monthly-limit.*})는
 * {@code 0} 을 <b>무제한</b>으로 해석했다. 두 규약이 섞이면 <b>권한 없는 계정이 무제한</b>이 되므로,
 * 판정은 반드시 이 클래스 하나만 거치게 한다.
 *
 * <p>모든 판정은 {@code null} 사용자를 <b>금지</b>로 본다 — 계정을 못 찾았을 때 열리면 안 된다.
 */
public final class SmsPermissions {

    /** 우리가 다루는 채널. {@code SolapiSmsSender.channelOf} 가 돌려주는 값과 같아야 한다. */
    public static final List<String> CHANNELS = List.of("SMS", "LMS", "MMS");

    /** 월 상한이 이 값이면 무제한. */
    public static final int UNLIMITED = -1;

    private SmsPermissions() {
    }

    /** 발송 자체가 허용된 계정인가. */
    public static boolean enabled(User user) {
        return user != null && user.isSmsEnabled();
    }

    /**
     * 이 채널을 보낼 수 있는가. 발송이 꺼져 있으면 채널과 무관하게 false.
     *
     * <p>⚠️ 채널은 <b>본문 길이·첨부에 따라 발송 시점에 결정</b>된다(90byte 초과 → LMS, 첨부 → MMS).
     * 그래서 SMS 만 허용된 계정이 긴 본문을 저장하면 <b>발송 때 조용히 막힌다</b> —
     * 편집 화면에서 미리 경고해야 한다(byte 카운터 옆).
     */
    public static boolean channelAllowed(User user, String channel) {
        if (!enabled(user) || channel == null || channel.isBlank()) {
            return false;
        }
        return allowedChannels(user).contains(channel.trim().toUpperCase());
    }

    /** 허용 채널 집합(정규화·중복 제거). 알 수 없는 토큰은 버린다. */
    public static Set<String> allowedChannels(User user) {
        Set<String> out = new LinkedHashSet<>();
        if (user == null || user.getSmsAllowedChannels() == null) {
            return out;
        }
        for (String raw : user.getSmsAllowedChannels().split(",")) {
            String token = raw.trim().toUpperCase();
            if (CHANNELS.contains(token)) {
                out.add(token);
            }
        }
        return out;
    }

    /** 저장용 CSV 로 정규화. 유효한 채널만 남기고 CHANNELS 순서로 정렬한다. */
    public static String normalizeChannels(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        Set<String> given = new LinkedHashSet<>();
        for (String token : raw.split(",")) {
            given.add(token.trim().toUpperCase());
        }
        return String.join(",", CHANNELS.stream().filter(given::contains).toList());
    }

    /** 월 상한이 무제한인가. */
    public static boolean unlimited(User user) {
        return user != null && user.getSmsMonthlyLimit() < 0;
    }

    /**
     * 이번 달 남은 발송 가능 건수. 무제한이면 {@link Integer#MAX_VALUE}.
     * 권한이 없거나 상한이 0 이면 0.
     */
    public static long remaining(User user, long usedThisMonth) {
        if (!enabled(user)) {
            return 0;
        }
        if (unlimited(user)) {
            return Integer.MAX_VALUE;
        }
        return Math.max(0, user.getSmsMonthlyLimit() - usedThisMonth);
    }

    /**
     * 발송을 막아야 하는 사유. 보낼 수 있으면 {@code null}.
     *
     * <p>사유 문구는 <b>이력에 그대로 남는다</b>({@code MessageLog.status=SKIPPED}) —
     * 마케터가 "왜 안 갔는지" 알 수 있어야 하므로 조용히 사라지게 두지 않는다.
     */
    public static String denyReason(User user, String channel, long usedThisMonth) {
        if (!enabled(user)) {
            return "이 계정은 문자 발송 권한이 없습니다. 운영자에게 문의해주세요.";
        }
        if (!channelAllowed(user, channel)) {
            return "이 계정은 " + channel + " 발송이 허용되지 않았습니다."
                    + (allowedChannels(user).isEmpty()
                            ? ""
                            : " (허용: " + String.join("·", allowedChannels(user)) + ")");
        }
        if (unlimited(user)) {
            return null;
        }
        int limit = user.getSmsMonthlyLimit();
        if (limit <= 0) {
            // 발송은 켜져 있지만 상한이 0 — 사실상 금지. 위 enabled 검사와 겹쳐 보이지만
            // 세 스위치를 독립적으로 두기로 했으므로 여기서도 막는다.
            return "이 계정의 월 발송 한도가 0건으로 설정돼 있습니다. 운영자에게 문의해주세요.";
        }
        if (usedThisMonth >= limit) {
            return "이번 달 문자 발송 한도(" + limit + "건)를 모두 사용했습니다.";
        }
        return null;
    }
}
