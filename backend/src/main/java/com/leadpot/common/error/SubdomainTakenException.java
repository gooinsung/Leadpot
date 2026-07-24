package com.leadpot.common.error;

/** 이미 사용 중인 서브도메인으로 변경을 시도한 경우(409). */
public class SubdomainTakenException extends RuntimeException {
    public SubdomainTakenException(String message) {
        super(message);
    }
}
