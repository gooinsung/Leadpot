package com.leadpot.lead.dto;

import jakarta.validation.constraints.NotNull;

/** 외부 API 전달 '미전송 일괄 전송' 요청. from/to 는 KST 날짜(yyyy-MM-dd), 비우면 제한 없음. */
public record OutboundUnsentRequest(@NotNull Long formId, String from, String to) {
}
