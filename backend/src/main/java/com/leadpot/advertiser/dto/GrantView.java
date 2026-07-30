package com.leadpot.advertiser.dto;

import java.time.Instant;

/**
 * 권한 부여 화면의 한 줄 = 마케터의 리드폼 하나.
 * <p>
 * 마케터의 모든 리드폼을 돌려주고, 이 광고주에게 부여됐는지({@code granted})와
 * <b>다른 광고주가 이미 쓰고 있는지</b>({@code takenBy})를 함께 알려준다.
 * 1리드폼:1광고주 이므로 {@code takenBy} 가 있는 폼은 화면에서 선택 불가로 만든다.
 */
public record GrantView(
        Long formId,
        String formName,
        boolean granted,
        String displayName,
        Instant expiresAt,
        boolean canStatus,
        boolean canMemo,
        boolean canExport,
        String takenBy) {
}
