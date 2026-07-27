package com.leadpot.lead.dto;

import java.time.Instant;

import com.leadpot.lead.LeadNote;

/** 리드 메모/이력 응답. kind=MEMO(사용자 메모) | SYSTEM(자동 이력). */
public record LeadNoteResponse(
        Long id,
        String kind,
        String body,
        Instant createdAt) {

    public static LeadNoteResponse from(LeadNote n) {
        return new LeadNoteResponse(n.getId(), n.getKind(), n.getBody(), n.getCreatedAt());
    }
}
