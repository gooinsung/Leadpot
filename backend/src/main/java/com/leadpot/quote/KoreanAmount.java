package com.leadpot.quote;

/** 금액을 한글로 — 견적서 총액 표기용(예: 2,750,000 → "이백칠십오만"). "일금 …원정" 은 호출하는 쪽이 붙인다. */
public final class KoreanAmount {

    private static final String[] DIGITS = { "", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구" };
    private static final String[] SMALL_UNITS = { "", "십", "백", "천" };
    private static final String[] BIG_UNITS = { "", "만", "억", "조", "경" };

    private KoreanAmount() {
    }

    public static String toHangul(long amount) {
        if (amount == 0) {
            return "영";
        }
        if (amount < 0) {
            return "마이너스 " + toHangul(-amount);
        }
        StringBuilder out = new StringBuilder();
        int big = 0;
        while (amount > 0) {
            int chunk = (int) (amount % 10000);
            if (chunk > 0) {
                out.insert(0, chunkToHangul(chunk) + BIG_UNITS[big]);
            }
            amount /= 10000;
            big++;
        }
        return out.toString();
    }

    /** 0~9999. 십·백·천 앞의 '일'은 생략한다(일천 → 천). */
    private static String chunkToHangul(int n) {
        StringBuilder sb = new StringBuilder();
        for (int pos = 3; pos >= 0; pos--) {
            int d = (n / (int) Math.pow(10, pos)) % 10;
            if (d == 0) {
                continue;
            }
            if (!(d == 1 && pos > 0)) {
                sb.append(DIGITS[d]);
            }
            sb.append(SMALL_UNITS[pos]);
        }
        return sb.toString();
    }
}
