package com.leadpot.htmlcomponent.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** HTML 요소 생성/수정 요청. name=관리용 이름, category=분류, html=삽입될 HTML. */
public record HtmlComponentRequest(
        @NotBlank @Size(max = 255) String name,
        @Size(max = 40) String category,
        String html) {
}
