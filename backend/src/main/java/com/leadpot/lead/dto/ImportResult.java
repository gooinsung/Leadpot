package com.leadpot.lead.dto;

import java.util.List;

/** 리드 일괄 가져오기 결과 요약. */
public record ImportResult(int created, int failed, List<String> errors) {
}
