package com.leadpot.consent.dto;

import java.time.Instant;

import com.leadpot.consent.ConsentDocument;

/** 동의 문서 목록/선택용 요약 (내용 제외). name=관리용 이름, title=공개 제목. */
public record ConsentDocumentSummary(
        Long id,
        String name,
        String title,
        Instant updatedAt) {

    public static ConsentDocumentSummary from(ConsentDocument d) {
        return new ConsentDocumentSummary(d.getId(), d.getName(), d.getTitle(), d.getUpdatedAt());
    }
}
