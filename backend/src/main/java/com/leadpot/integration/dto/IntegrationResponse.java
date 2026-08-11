package com.leadpot.integration.dto;

import com.leadpot.integration.IntegrationSettings;

/**
 * 계정 연동 설정 응답(텔레그램 계정 채널). 구글시트 연결 정보는 리드폼별 설정으로 이동했지만,
 * <b>서비스 계정 이메일</b>은 서버 공통 값이라 여기서 함께 내려준다 —
 * 광고주에게 "이 이메일을 시트 편집자로 추가하세요" 라고 안내할 주소다(비밀이 아니다).
 */
public record IntegrationResponse(
        boolean telegramEnabled,
        String telegramBotToken,
        String telegramChatId,
        String sheetsServiceAccountEmail) {

    public static IntegrationResponse from(IntegrationSettings s, String sheetsServiceAccountEmail) {
        if (s == null) {
            return new IntegrationResponse(false, "", "", nn(sheetsServiceAccountEmail));
        }
        return new IntegrationResponse(
                s.isTelegramEnabled(),
                nn(s.getTelegramBotToken()),
                nn(s.getTelegramChatId()),
                nn(sheetsServiceAccountEmail));
    }

    private static String nn(String s) {
        return s == null ? "" : s;
    }
}
