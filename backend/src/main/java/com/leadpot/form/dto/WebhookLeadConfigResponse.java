package com.leadpot.form.dto;

import java.util.List;
import java.util.Map;

/**
 * 웹훅 수신 설정 조회 응답. 토큰 원문은 절대 포함하지 않는다(생성/재발급 응답에서 한 번만 내려간다).
 * availableAnswerLabels/availableConsentTitles 는 매핑 화면 드롭다운용 — 지금 리드폼의 항목 라벨/동의 제목.
 */
public record WebhookLeadConfigResponse(
        boolean enabled,
        boolean hasToken,
        Map<String, String> answerMapping,
        Map<String, String> consentMapping,
        String externalIdKey,
        /** 페이로드 값과 무관하게 항상 동의로 처리할 동의 제목 목록. */
        List<String> alwaysAgreedConsents,
        List<String> availableAnswerLabels,
        List<String> availableConsentTitles,
        Map<String, Object> lastPayload,
        String lastReceivedAt,
        String lastError,
        String lastErrorAt) {
}
