package com.leadpot.quote;

import java.util.List;

import com.leadpot.quote.dto.QuoteItem;

/**
 * 견적 합계 계산 — 서버가 저장할 때마다 다시 계산한다(화면이 보낸 합계는 믿지 않는다).
 * 화면(frontend {@code lib/quote.ts})도 같은 식으로 미리보기를 그리므로 <b>둘을 함께 고쳐야 한다</b>.
 * <ul>
 * <li>줄 금액 = 수량 × 단가</li>
 * <li>별도: 공급가 = 줄 금액 합, 부가세 = 공급가 × 10%(원 미만 절사), 총액 = 공급가 + 부가세</li>
 * <li>포함: 총액 = 줄 금액 합, 공급가 = 총액 ÷ 1.1(반올림), 부가세 = 총액 − 공급가</li>
 * <li>면세: 공급가 = 총액 = 줄 금액 합, 부가세 0</li>
 * </ul>
 */
public final class QuoteCalculator {

    private QuoteCalculator() {
    }

    public record Totals(long supply, long vat, long grand) {
    }

    public static long lineAmount(QuoteItem item) {
        return item.quantity() * item.unitPrice();
    }

    public static Totals totals(List<QuoteItem> items, VatMode mode) {
        long sum = 0;
        for (QuoteItem it : items) {
            sum += lineAmount(it);
        }
        return switch (mode) {
            case EXCLUDED -> {
                long vat = Math.floorDiv(sum, 10);
                yield new Totals(sum, vat, sum + vat);
            }
            case INCLUDED -> {
                long supply = Math.round(sum / 1.1);
                yield new Totals(supply, sum - supply, sum);
            }
            case EXEMPT -> new Totals(sum, 0, sum);
        };
    }
}
