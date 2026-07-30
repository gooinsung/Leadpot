package com.leadpot.lead.dto;

import java.time.Instant;

import com.leadpot.lead.LeadNote;

/**
 * 리드 메모/이력 응답. kind=MEMO(사용자 메모) | SYSTEM(자동 이력).
 * <p>
 * 마케터는 모든 메모를 본다. {@code sharedWithAdvertiser} 가 true 면 광고주에게도 보이는 메모다
 * (광고주가 남긴 메모, 광고주 상태변경 이력). 마케터 내부 메모는 false.
 */
public record LeadNoteResponse(
        Long id,
        String kind,
        String body,
        boolean sharedWithAdvertiser,
        Instant createdAt) {

    public static LeadNoteResponse from(LeadNote n) {
        return new LeadNoteResponse(n.getId(), n.getKind(), n.getBody(),
                n.isSharedWithAdvertiser(), n.getCreatedAt());
    }
}
