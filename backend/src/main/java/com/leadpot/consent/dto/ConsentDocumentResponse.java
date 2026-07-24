package com.leadpot.consent.dto;

import java.time.Instant;

import com.leadpot.consent.ConsentDocument;

/** 동의 문서 상세/공개 응답. name=관리용 이름(공개 화면에선 미노출), title/content=공개 노출. */
public record ConsentDocumentResponse(
        Long id,
        String name,
        String title,
        String content,
        Instant updatedAt) {

    public static ConsentDocumentResponse from(ConsentDocument d) {
        return new ConsentDocumentResponse(d.getId(), d.getName(), d.getTitle(), d.getContent(), d.getUpdatedAt());
    }
}
