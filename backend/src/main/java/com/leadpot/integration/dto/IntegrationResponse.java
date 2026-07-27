package com.leadpot.integration.dto;

import com.leadpot.integration.IntegrationSettings;

/** 연동 설정 응답. 사용자 본인의 설정을 편집 화면에 그대로 표시한다(본인 리소스). */
public record IntegrationResponse(
        boolean telegramEnabled,
        String telegramBotToken,
        String telegramChatId,
        boolean sheetsEnabled,
        String sheetsWebhookUrl) {

    public static IntegrationResponse from(IntegrationSettings s) {
        if (s == null) {
            return new IntegrationResponse(false, "", "", false, "");
        }
        return new IntegrationResponse(
                s.isTelegramEnabled(),
                nn(s.getTelegramBotToken()),
                nn(s.getTelegramChatId()),
                s.isSheetsEnabled(),
                nn(s.getSheetsWebhookUrl()));
    }

    private static String nn(String s) {
        return s == null ? "" : s;
    }
}
