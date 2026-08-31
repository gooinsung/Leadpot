package com.leadpot.form.dto;

import java.util.Map;

/**
 * 웹훅 원본 키 매핑 저장 요청. answerMapping/consentMapping 의 키=원본 페이로드 키,
 * 값=리드폼 항목 라벨(FIELD)/질문(CHOICE) 또는 동의 항목 제목 — 그대로 매치돼야 한다(대소문자 포함).
 * externalIdKey 는 멱등성에 쓸 원본 키(비우면 페이로드 해시로 폴백).
 */
public record WebhookMappingRequest(
        Map<String, String> answerMapping,
        Map<String, String> consentMapping,
        String externalIdKey) {

    public Map<String, String> answerMappingOrEmpty() {
        return answerMapping == null ? Map.of() : answerMapping;
    }

    public Map<String, String> consentMappingOrEmpty() {
        return consentMapping == null ? Map.of() : consentMapping;
    }
}
