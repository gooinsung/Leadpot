package com.leadpot.integration.dto;

/** 계정 연동 설정 저장 요청(텔레그램 계정 채널). 구글시트는 리드폼별 설정으로 이동. */
public record IntegrationRequest(
        boolean telegramEnabled,
        String telegramBotToken,
        String telegramChatId) {
}
