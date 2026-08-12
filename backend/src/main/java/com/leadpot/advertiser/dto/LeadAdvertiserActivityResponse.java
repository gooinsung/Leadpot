package com.leadpot.advertiser.dto;

import java.time.Instant;
import java.util.List;

/**
 * 마케터 리드 상세의 <b>'광고주' 섹션</b>(V33) — 이 리드를 광고주가 실제로 보기는 했는지.
 *
 * <p>기존엔 {@code advertiser_seen_at} 한 칸(봤다/안 봤다)뿐이라 답할 수 없는 게 많았다.
 * 언제 봤는지, 몇 번 봤는지, 열어만 보고 말았는지 실제로 처리까지 했는지 —
 * 그래서 시각 하나 대신 <b>요약 + 시간순 이력</b>을 함께 내린다.
 *
 * <h3>확신 등급 {@link #level()}</h3>
 * <ul>
 * <li>{@code NO_ADVERTISER} — 이 리드폼에 배정된 광고주가 없다(섹션을 그리지 않는다).</li>
 * <li>{@code NOT_VIEWED} — 포털에서 연 적이 없다. 광고주가 알림톡·시트로만 일할 수도 있으니
 *     "안 봤다"의 확정이 아니라 <b>포털 열람 기록이 없다</b>는 뜻이다.</li>
 * <li>{@code VIEWED} — 열어는 봤다.</li>
 * <li>{@code ACTED} — 상태 변경·메모처럼 <b>행동</b>이 있다. 실제로 봤다는 가장 강한 증거.</li>
 * </ul>
 */
public record LeadAdvertiserActivityResponse(
        Long leadId,
        /** 이 리드폼에 배정된 광고주. null 이면 아직 아무에게도 안 넘겼다는 뜻. */
        Long advertiserId,
        /** 표시용 이름(회사명 → 이름 → 이메일 순). */
        String advertiserName,
        String advertiserEmail,
        boolean advertiserActive,
        /** 광고주가 포털에 마지막으로 로그인한 시각. 열람 기록이 없을 때 원인 판단에 쓴다. */
        Instant advertiserLastLoginAt,
        /** 이 리드를 처음 연 시각(= {@code advertiser_seen_at}). */
        Instant firstViewedAt,
        Instant lastViewedAt,
        /** 열람 이력 줄 수. 30분 안의 재열람은 한 줄로 접힌다. */
        int viewCount,
        /** 상태 변경·메모 등 열람 이후의 행동이 있었는지. */
        boolean acted,
        String level,
        List<AdvertiserLogResponse> entries) {

    public static final String LEVEL_NONE = "NO_ADVERTISER";
    public static final String LEVEL_NOT_VIEWED = "NOT_VIEWED";
    public static final String LEVEL_VIEWED = "VIEWED";
    public static final String LEVEL_ACTED = "ACTED";

    /** 배정된 광고주가 없을 때. 프론트는 이 경우 섹션을 그리지 않는다. */
    public static LeadAdvertiserActivityResponse none(Long leadId) {
        return new LeadAdvertiserActivityResponse(leadId, null, null, null, false, null,
                null, null, 0, false, LEVEL_NONE, List.of());
    }

    /** 요약값에서 확신 등급을 뽑는다. 행동 > 열람 > 미열람 순. */
    public static String level(boolean acted, int viewCount) {
        if (acted) {
            return LEVEL_ACTED;
        }
        return viewCount > 0 ? LEVEL_VIEWED : LEVEL_NOT_VIEWED;
    }
}
