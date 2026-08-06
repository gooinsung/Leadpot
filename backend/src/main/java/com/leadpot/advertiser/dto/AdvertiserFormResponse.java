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
        boolean canExport,
        /** 마케터가 이 리드폼의 광고주 접수 알림을 켰는지. 꺼져 있으면 번호를 넣어도 발송되지 않는다. */
        boolean notifyEnabled,
        /** 내가 등록한 수신번호. 없으면 빈 문자열 — 이 값이 있어야 실제로 발송된다. */
        String notifyPhone) {
}
