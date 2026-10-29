package com.leadpot.quote.dto;

import java.time.Instant;
import java.time.LocalDate;

import com.leadpot.quote.Quote;
import com.leadpot.quote.QuoteStatus;

/** 견적서 목록 한 줄. */
public record QuoteSummary(
        Long id,
        String quoteNo,
        String title,
        String recipientName,
        Long advertiserProfileId,
        LocalDate issueDate,
        QuoteStatus status,
        long grandTotal,
        Instant updatedAt) {

    public static QuoteSummary from(Quote q) {
        return new QuoteSummary(q.getId(), q.getQuoteNo(), q.getTitle(),
                QuoteParty.fromMap(q.getRecipient()).companyName(), q.getAdvertiserProfileId(), q.getIssueDate(),
                q.getStatus(), q.getGrandTotal(), q.getUpdatedAt());
    }
}
