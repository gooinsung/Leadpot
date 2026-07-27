package com.leadpot.integration.dto;

import com.leadpot.integration.IntegrationSettings;

/** 계정 연동 설정 응답(텔레그램 계정 채널). 구글시트는 리드폼별 설정으로 이동. */
public record IntegrationResponse(
        boolean telegramEnabled,
        String telegramBotToken,
        String telegramChatId) {

    public static IntegrationResponse from(IntegrationSettings s) {
        if (s == null) {
            return new IntegrationResponse(false, "", "");
        }
        return new IntegrationResponse(
                s.isTelegramEnabled(),
                nn(s.getTelegramBotToken()),
                nn(s.getTelegramChatId()));
    }

    private static String nn(String s) {
        return s == null ? "" : s;
    }
}
