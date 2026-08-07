package com.leadpot.lead.dto;

import java.time.Instant;
import java.util.List;

import com.leadpot.lead.LeadAsRequest;

/** AS 요청 응답(V30). 마케터·광고주 화면 공용 — 개인정보가 없어 화이트리스트가 필요 없다. */
public record LeadAsRequestResponse(
        Long id,
        String status,
        String reason,
        List<String> evidenceUrls,
        String resolutionNote,
        Instant createdAt,
        Instant resolvedAt) {

    public static LeadAsRequestResponse from(LeadAsRequest r) {
        return new LeadAsRequestResponse(r.getId(), r.getStatus(), r.getReason(),
                r.getEvidenceUrls() == null ? List.of() : r.getEvidenceUrls(),
                r.getResolutionNote(), r.getCreatedAt(), r.getResolvedAt());
    }
}
