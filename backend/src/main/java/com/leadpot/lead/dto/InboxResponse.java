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
            /** 폼의 분야(개인회생 등, V34). 리드가 폼을 통해 물려받는다. null = 미지정. */
            String formCategory,
            List<Map<String, Object>> answers,
            String status,
            /** 필터·라벨 키(고정=코드, 커스텀=C{id}). 라벨은 counts.statusNames[statusKey]. */
            String statusKey,
            List<String> tags,
            /** 유입 파라미터(media_from 등, 화이트리스트 통과분). 목록의 '출처' 칩이 그린다. null 가능. */
            Map<String, Object> utm,
            Instant createdAt,
            /** 마케터가 열어본 시각. null 이면 '미확인'(V32). 상태와 무관하다. */
            Instant seenAt) {
    }

    /** 사이드 rail 카운트(전체 기준). */
    public record Counts(
            long all,
            long unseen,
            long today,
            List<FormCount> byForm,
            /** 분야별 리드 수(V34) — 분야 드롭다운 옵션. 분야 있는 폼의 리드만, 많은 순. */
            List<CategoryCount> byCategory,
            /** 키 = statusKey(고정 코드 또는 C{id}). */
            Map<String, Long> byStatus,
            /** statusKey → 화면 라벨(커스텀 상태 이름 포함). rail·목록이 이 맵으로 그린다. */
            Map<String, String> statusNames) {
    }

    public record FormCount(Long formId, String formName, long count) {
    }

    public record CategoryCount(String name, long count) {
    }
}
