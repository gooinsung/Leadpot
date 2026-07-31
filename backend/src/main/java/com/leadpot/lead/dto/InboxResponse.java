package com.leadpot.lead.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 통합 인박스(U1) 응답 — 내 모든 리드폼의 리드를 한 스트림으로.
 * <p>
 * 왼쪽 필터 rail 숫자({@link Counts})는 <b>현재 필터와 무관하게 전체 기준</b>으로 계산한다
 * (이메일 폴더처럼 "미확인 12" 가 필터를 바꿔도 유지되도록).
 */
public record InboxResponse(
        List<Item> items,
        int total,
        int page,
        int size,
        Counts counts) {

    /** 목록 한 줄. 출처 폼명을 함께 담아 어느 폼에서 왔는지 바로 보이게 한다. 상세는 {@code GET /api/leads/{id}} 로. */
    public record Item(
            Long id,
            Long formId,
            String formName,
            List<Map<String, Object>> answers,
            String status,
            List<String> tags,
            Instant createdAt) {
    }

    /** 사이드 rail 카운트(전체 기준). */
    public record Counts(
            long all,
            long unseen,
            long today,
            List<FormCount> byForm,
            Map<String, Long> byStatus) {
    }

    public record FormCount(Long formId, String formName, long count) {
    }
}
