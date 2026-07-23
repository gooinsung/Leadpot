package com.leadpot.consent.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 동의 문서 생성/수정 요청. */
public record ConsentDocumentRequest(
        @NotBlank @Size(max = 255) String title,
        String content) {
}
