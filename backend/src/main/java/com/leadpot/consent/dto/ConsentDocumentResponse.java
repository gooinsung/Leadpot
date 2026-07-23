package com.leadpot.consent.dto;

import java.time.Instant;

import com.leadpot.consent.ConsentDocument;

/** 동의 문서 상세/공개 응답 (title + content). */
public record ConsentDocumentResponse(
        Long id,
        String title,
        String content,
        Instant updatedAt) {

    public static ConsentDocumentResponse from(ConsentDocument d) {
        return new ConsentDocumentResponse(d.getId(), d.getTitle(), d.getContent(), d.getUpdatedAt());
    }
}
