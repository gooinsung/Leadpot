package com.leadpot.htmlcomponent.dto;

import java.time.Instant;

import com.leadpot.htmlcomponent.HtmlComponent;

/** HTML 요소 목록/선택용 요약 (html 제외 — 선택 시 상세로 html 로드). */
public record HtmlComponentSummary(
        Long id,
        String name,
        String category,
        Instant updatedAt) {

    public static HtmlComponentSummary from(HtmlComponent c) {
        return new HtmlComponentSummary(c.getId(), c.getName(), c.getCategory(), c.getUpdatedAt());
    }
}
