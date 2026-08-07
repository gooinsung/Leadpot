package com.leadpot.advertiser.dto;

import java.time.Instant;

import com.leadpot.lead.LeadNote;

/**
 * 광고주에게 보이는 메모/이력 (visibility=ALL 만). 작성자 id 는 노출하지 않는다.
 * <p>
 * {@code authorRole} 은 화면의 작성자 표기용("마케터"/"광고주", 2026-08-08 사용자 확정).
 * 값: MARKETER | ADVERTISER | null(작성자 삭제·미상).
 */
public record AdvertiserNoteResponse(
        Long id,
        String kind,
        String body,
        boolean mine,
        String authorRole,
        Instant createdAt) {

    public static AdvertiserNoteResponse of(LeadNote note, Long advertiserId, String authorRole) {
        // ⚠️ 비교 순서 주의: 작성자가 삭제된 메모는 ownerId 가 null 이다(V27).
        //    note.getOwnerId().equals(...) 로 쓰면 그런 메모가 섞인 리드에서 목록 전체가 500 이 된다.
        return new AdvertiserNoteResponse(note.getId(), note.getKind(), note.getBody(),
                advertiserId != null && advertiserId.equals(note.getOwnerId()), authorRole, note.getCreatedAt());
    }
}
