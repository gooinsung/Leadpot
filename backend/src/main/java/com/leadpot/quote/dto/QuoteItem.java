package com.leadpot.quote.dto;

import java.util.LinkedHashMap;
import java.util.Map;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/**
 * 품목 한 줄(표 칸 고정: 품목 · 설명 · 수량 · 단가 · 금액(자동) · 비고). 단가는 원 단위.
 * 단가는 음수도 허용한다 — '할인' 줄을 넣을 수 있게.
 */
public record QuoteItem(
        @Size(max = 200, message = "품목은 200자 이하여야 합니다.") String name,
        @Size(max = 300, message = "설명은 300자 이하여야 합니다.") String description,
        @Min(value = 0, message = "수량은 0 이상이어야 합니다.") @Max(value = 10_000_000, message = "수량이 너무 큽니다.") long quantity,
        @Min(value = -1_000_000_000_000L, message = "단가가 너무 작습니다.") @Max(value = 1_000_000_000_000L, message = "단가가 너무 큽니다.") long unitPrice,
        @Size(max = 200, message = "비고는 200자 이하여야 합니다.") String note) {

    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", name == null ? "" : name.trim());
        m.put("description", description == null ? "" : description.trim());
        m.put("quantity", quantity);
        m.put("unitPrice", unitPrice);
        m.put("note", note == null ? "" : note.trim());
        return m;
    }

    public static QuoteItem fromMap(Map<String, Object> m) {
        return new QuoteItem(str(m.get("name")), str(m.get("description")), num(m.get("quantity")),
                num(m.get("unitPrice")), str(m.get("note")));
    }

    private static String str(Object v) {
        return v == null ? "" : v.toString();
    }

    private static long num(Object v) {
        if (v instanceof Number n) {
            return n.longValue();
        }
        try {
            return v == null ? 0 : Long.parseLong(v.toString());
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
