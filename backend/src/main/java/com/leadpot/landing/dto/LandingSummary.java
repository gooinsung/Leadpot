package com.leadpot.landing.dto;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.leadpot.landing.LandingPage;

/** 랜딩 목록용 요약. */
public record LandingSummary(
        Long id,
        String title,
        String slug,
        String status,
        Long folderId,
        /** 자유 태그(V46). 없으면 빈 배열. */
        List<String> tags,
        /** 이 랜딩의 리드폼(FORM) 블록이 연결한 리드폼 id(중복 제거, 블록 순서) — '이 리드폼을 쓰는 랜딩' 표시용. */
        List<Long> formIds,
        Instant updatedAt) {

    public static LandingSummary from(LandingPage l) {
        return new LandingSummary(l.getId(), l.getTitle(), l.getSlug(), l.getStatus(), l.getFolderId(),
                l.getTags() == null ? List.of() : l.getTags(), formIdsOf(l.getContent()), l.getUpdatedAt());
    }

    /** content 의 FORM 블록에서 formId 를 뽑는다(formId 가 없거나 숫자가 아니면 건너뜀). */
    static List<Long> formIdsOf(List<Map<String, Object>> content) {
        List<Long> ids = new ArrayList<>();
        if (content == null) return ids;
        for (Map<String, Object> block : content) {
            if (block == null || !"FORM".equals(block.get("type"))) continue;
            Long id = toLong(block.get("formId"));
            if (id != null && !ids.contains(id)) ids.add(id);
        }
        return ids;
    }

    private static Long toLong(Object v) {
        if (v instanceof Number n) return n.longValue();
        if (v instanceof String s && !s.isBlank()) {
            try {
                return Long.parseLong(s.trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
}
