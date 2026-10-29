package com.leadpot.quote;

/**
 * 견적서 상태. {@code DRAFT} 만 내용을 고칠 수 있다 — 발행하면 그 시점 내용으로 잠근다.
 * 발행 뒤에는 ISSUED · ACCEPTED · REJECTED 사이만 오간다(작성중으로 되돌리지 않는다. 고치려면 복제).
 */
public enum QuoteStatus {
    DRAFT,
    ISSUED,
    ACCEPTED,
    REJECTED
}
