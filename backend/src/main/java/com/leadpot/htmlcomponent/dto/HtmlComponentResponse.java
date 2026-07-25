package com.leadpot.htmlcomponent.dto;

import java.time.Instant;

import com.leadpot.htmlcomponent.HtmlComponent;

/** HTML 요소 상세 응답(html 포함 — 삽입용). */
public record HtmlComponentResponse(
        Long id,
        String name,
        String category,
        String html,
        Instant updatedAt) {

    public static HtmlComponentResponse from(HtmlComponent c) {
        return new HtmlComponentResponse(c.getId(), c.getName(), c.getCategory(), c.getHtml(), c.getUpdatedAt());
    }
}
