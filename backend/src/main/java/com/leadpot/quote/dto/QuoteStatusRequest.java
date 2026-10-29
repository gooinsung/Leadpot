package com.leadpot.quote.dto;

import com.leadpot.quote.QuoteStatus;

import jakarta.validation.constraints.NotNull;

/** 발행 후 상태 변경(발행 · 수락 · 거절). 작성중으로 되돌릴 수는 없다. */
public record QuoteStatusRequest(@NotNull QuoteStatus status) {
}
