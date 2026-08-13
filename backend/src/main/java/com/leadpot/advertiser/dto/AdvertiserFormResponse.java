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
        /**
         * 이 리드폼에만 지정한 전용 번호. 빈 문자열이면 <b>계정 기본 번호를 따라간다</b>(V33).
         * 실제로 발송되는 번호는 {@link #effectiveNotifyPhone} 을 봐야 한다.
         */
        String notifyPhone,
        /** true 면 이 리드폼만 알림을 끈 상태. 계정 기본 번호가 있어도 보내지 않는다. */
        boolean notifyDisabled,
        /**
         * 실제로 발송될 번호(폼 전용 → 계정 기본 순). 끄거나 둘 다 없으면 빈 문자열.
         * 화면이 "지금 어디로 가는지"를 한 줄로 보여주기 위한 값이다.
         */
        String effectiveNotifyPhone) {
}
