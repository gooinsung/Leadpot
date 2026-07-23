package com.leadpot.form.dto;

import java.util.List;
import java.util.Map;

import com.leadpot.form.FormType;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 폼 생성/수정 요청. */
public record FormRequest(
        @NotBlank @Size(max = 255) String name,
        @NotNull FormType formType,
        Boolean requirePhoneVerification,
        Map<String, Object> consentConfig,
        Map<String, Object> submitButtonConfig,
        Map<String, Object> successConfig,
        Map<String, Object> typeConfig,
        @Valid List<FormBlockDto> blocks) {

    public List<FormBlockDto> blocksOrEmpty() {
        return blocks == null ? List.of() : blocks;
    }
}
