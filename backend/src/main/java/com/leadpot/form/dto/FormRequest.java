package com.leadpot.form.dto;

import java.util.List;
import java.util.Map;

import com.leadpot.form.FormType;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 리드폼 생성/수정 요청. ⚠️ 유입 방식(source, V39)은 여기 없다 — 웹훅 설정 API(활성화/비활성화)로만
 * 바뀐다. 이 DTO 에 넣으면 다른 설정 저장할 때마다 값이 실려와 실수로 되돌릴 위험이 있다.
 */
public record FormRequest(
        @NotBlank @Size(max = 255) String name,
        /** 분야(업종 구분, V34). 빈 값이면 미지정(null 저장). */
        @Size(max = 50) String category,
        @NotNull FormType formType,
        Boolean requirePhoneVerification,
        Map<String, Object> consentConfig,
        Map<String, Object> submitButtonConfig,
        Map<String, Object> successConfig,
        Map<String, Object> typeConfig,
        Map<String, Object> styleConfig,
        Map<String, Object> settingsConfig,
        Map<String, Object> trackingConfig,
        @Valid List<FormBlockDto> blocks) {

    public List<FormBlockDto> blocksOrEmpty() {
        return blocks == null ? List.of() : blocks;
    }
}
