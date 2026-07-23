package com.leadpot.consent.dto;

import java.time.Instant;

import com.leadpot.consent.ConsentDocument;

/** 동의 문서 목록/선택용 요약 (내용 제외). */
public record ConsentDocumentSummary(
        Long id,
        String title,
        Instant updatedAt) {

    public static ConsentDocumentSummary from(ConsentDocument d) {
        return new ConsentDocumentSummary(d.getId(), d.getTitle(), d.getUpdatedAt());
    }
}
