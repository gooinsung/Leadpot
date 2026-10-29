package com.leadpot.quote;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.leadpot.quote.dto.QuoteItem;

class QuoteCalculatorTest {

    private static final List<QuoteItem> ITEMS = List.of(
            new QuoteItem("개인회생 DB", "메타", 50, 50_000, ""),
            new QuoteItem("할인", "", 1, -100_005, ""));

    @Test
    @DisplayName("부가세 별도 — 공급가의 10%, 원 미만 절사")
    void excluded() {
        QuoteCalculator.Totals t = QuoteCalculator.totals(ITEMS, VatMode.EXCLUDED);
        assertThat(t.supply()).isEqualTo(2_399_995);
        assertThat(t.vat()).isEqualTo(239_999);
        assertThat(t.grand()).isEqualTo(2_639_994);
    }

    @Test
    @DisplayName("부가세 포함 — 합계를 1.1 로 나눠 공급가·부가세를 가른다")
    void included() {
        QuoteCalculator.Totals t = QuoteCalculator.totals(List.of(new QuoteItem("A", "", 1, 2_750_000, "")),
                VatMode.INCLUDED);
        assertThat(t.supply()).isEqualTo(2_500_000);
        assertThat(t.vat()).isEqualTo(250_000);
        assertThat(t.grand()).isEqualTo(2_750_000);
    }

    @Test
    @DisplayName("면세 — 부가세 0")
    void exempt() {
        QuoteCalculator.Totals t = QuoteCalculator.totals(ITEMS, VatMode.EXEMPT);
        assertThat(t.vat()).isZero();
        assertThat(t.grand()).isEqualTo(t.supply());
    }
}
