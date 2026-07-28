package com.leadpot.lead.dto;

import java.util.List;

/**
 * 리드 내보내기 요청 본문.
 * - format: "csv"(기본) | "xlsx"
 * - columns: 내보낼 컬럼(생략/빈 값이면 전체)
 * - ids: 내보낼 리드 id(생략/빈 값이면 전체). 화면 필터가 적용된 리드만 보낼 때 사용.
 */
public record LeadExportRequest(String format, List<String> columns, List<Long> ids) {
}
