package com.leadpot.quote.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.leadpot.quote.KoreanAmount;
import com.leadpot.quote.Quote;
import com.leadpot.quote.QuoteCalculator;
import com.leadpot.quote.QuoteStatus;
import com.leadpot.quote.VatMode;

/** 견적서 상세. 줄 금액·한글 총액은 응답 때 계산해 붙인다(저장하지 않는다). */
public record QuoteResponse(
        Long id,
        String quoteNo,
        String title,
        LocalDate issueDate,
        LocalDate validUntil,
        QuoteStatus status,
        VatMode vatMode,
        Long advertiserProfileId,
        QuoteParty supplier,
        QuoteParty recipient,
        List<Line> items,
        List<String> notes,
        long supplyTotal,
        long vatTotal,
        long grandTotal,
        String grandTotalHangul,
        Instant issuedAt,
        Instant createdAt,
        Instant updatedAt) {

    public record Line(String name, String description, long quantity, long unitPrice, long amount, String note) {
    }

    public static QuoteResponse from(Quote q) {
        List<Line> lines = q.getItems().stream().map(QuoteItem::fromMap)
                .map(i -> new Line(i.name(), i.description(), i.quantity(), i.unitPrice(),
                        QuoteCalculator.lineAmount(i), i.note()))
                .toList();
        return new QuoteResponse(q.getId(), q.getQuoteNo(), q.getTitle(), q.getIssueDate(), q.getValidUntil(),
                q.getStatus(), q.getVatMode(), q.getAdvertiserProfileId(), QuoteParty.fromMap(q.getSupplier()),
                QuoteParty.fromMap(q.getRecipient()), lines, q.getNotes(), q.getSupplyTotal(), q.getVatTotal(),
                q.getGrandTotal(), KoreanAmount.toHangul(q.getGrandTotal()), q.getIssuedAt(), q.getCreatedAt(),
                q.getUpdatedAt());
    }
}
