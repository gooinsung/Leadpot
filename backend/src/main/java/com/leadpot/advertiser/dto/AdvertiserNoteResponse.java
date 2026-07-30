package com.leadpot.advertiser.dto;

import java.time.Instant;

import com.leadpot.lead.LeadNote;

/** 광고주에게 보이는 메모/이력 (visibility=ALL 만). 작성자 id 는 노출하지 않는다. */
public record AdvertiserNoteResponse(
        Long id,
        String kind,
        String body,
        boolean mine,
        Instant createdAt) {

    public static AdvertiserNoteResponse of(LeadNote note, Long advertiserId) {
        return new AdvertiserNoteResponse(note.getId(), note.getKind(), note.getBody(),
                note.getOwnerId().equals(advertiserId), note.getCreatedAt());
    }
}
