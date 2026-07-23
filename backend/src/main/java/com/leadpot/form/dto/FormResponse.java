package com.leadpot.form.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.leadpot.form.Form;
import com.leadpot.form.FormType;

/** 폼 상세 응답. */
public record FormResponse(
        Long id,
        String name,
        FormType formType,
        boolean requirePhoneVerification,
        Map<String, Object> consentConfig,
        Map<String, Object> submitButtonConfig,
        Map<String, Object> successConfig,
        Map<String, Object> typeConfig,
        Map<String, Object> styleConfig,
        List<FormBlockDto> blocks,
        Instant createdAt,
        Instant updatedAt) {

    public static FormResponse from(Form form) {
        List<FormBlockDto> blocks = form.getBlocks().stream().map(FormBlockDto::from).toList();
        return new FormResponse(
                form.getId(),
                form.getName(),
                form.getFormType(),
                form.isRequirePhoneVerification(),
                form.getConsentConfig(),
                form.getSubmitButtonConfig(),
                form.getSuccessConfig(),
                form.getTypeConfig(),
                form.getStyleConfig(),
                blocks,
                form.getCreatedAt(),
                form.getUpdatedAt());
    }
}
