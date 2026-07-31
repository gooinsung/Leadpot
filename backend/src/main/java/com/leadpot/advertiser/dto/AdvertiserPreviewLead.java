package com.leadpot.advertiser.dto;

import java.util.List;

/**
 * 미리보기 리드 상세(읽기 전용) — 리드 응답 + 공유 메모를 한 번에 담아 왕복을 줄인다.
 */
public record AdvertiserPreviewLead(
        AdvertiserLeadResponse lead,
        List<AdvertiserNoteResponse> notes) {
}
