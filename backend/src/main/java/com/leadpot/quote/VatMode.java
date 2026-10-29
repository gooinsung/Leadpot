package com.leadpot.quote;

/**
 * 부가세 방식.
 * <ul>
 * <li>{@code EXCLUDED} 별도 — 단가는 공급가, 부가세 = 공급가 합계의 10%(원 미만 절사)</li>
 * <li>{@code INCLUDED} 포함 — 단가에 부가세가 들어 있다. 합계를 1.1 로 나눠 공급가·부가세를 가른다</li>
 * <li>{@code EXEMPT} 면세 — 부가세 0</li>
 * </ul>
 */
public enum VatMode {
    EXCLUDED,
    INCLUDED,
    EXEMPT
}
