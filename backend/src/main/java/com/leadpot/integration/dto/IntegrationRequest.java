package com.leadpot.integration.dto;

/** 연동 설정 저장 요청. 값이 비어 있으면 해당 채널은 비활성으로 취급된다. */
public record IntegrationRequest(
        boolean telegramEnabled,
        String telegramBotToken,
        String telegramChatId,
        boolean sheetsEnabled,
        String sheetsWebhookUrl) {
}
