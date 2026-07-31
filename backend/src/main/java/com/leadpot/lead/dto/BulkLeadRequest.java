package com.leadpot.lead.dto;

import java.util.List;

/**
 * 리드 일괄 작업 요청(U2). ids = 대상 리드 번호들.
 * status = 일괄 상태변경 시 사용(휴지통 이동엔 불필요).
 */
public record BulkLeadRequest(List<Long> ids, String status) {
}
