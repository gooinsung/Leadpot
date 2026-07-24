package com.leadpot.consent.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 동의 문서 생성/수정 요청. name=관리용 이름, title=공개 제목, content=공개 내용. */
public record ConsentDocumentRequest(
        @NotBlank @Size(max = 255) String name,
        @NotBlank @Size(max = 255) String title,
        String content) {
}
