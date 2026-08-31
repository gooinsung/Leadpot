package com.leadpot.lead.dto;

import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.NotNull;

/** 공개 리드폼 제출 요청(비로그인). answers/consents 는 프론트 렌더러가 구성해 보낸다. */
public record LeadSubmitRequest(
        @NotNull Long formId,
        Long landingPageId,
        List<Map<String, Object>> answers,
        List<Map<String, Object>> consents,
        Map<String, Object> utm,
        String groupTag,
        /** 웹훅 유입 멱등성 키(V39). 우리 공개 폼(SELF) 제출은 항상 null — {@link WebhookLeadService} 만 채운다. */
        String externalId) {

    public List<Map<String, Object>> answersOrEmpty() {
        return answers == null ? List.of() : answers;
    }

    public List<Map<String, Object>> consentsOrEmpty() {
        return consents == null ? List.of() : consents;
    }
}
