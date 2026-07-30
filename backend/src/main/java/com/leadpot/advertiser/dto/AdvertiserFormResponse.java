package com.leadpot.advertiser.dto;

/**
 * 광고주가 볼 수 있는 리드폼 항목.
 * 이름은 마케터가 지정한 표시 이름(display_name)을 우선한다 —
 * 내부 폼명(예: A병원_7월_리타겟_v3)을 광고주에게 그대로 보여주지 않기 위함.
 */
public record AdvertiserFormResponse(
        Long formId,
        String name,
        long leadCount,
        long unseenCount,
        boolean canStatus,
        boolean canMemo,
        boolean canExport) {
}
