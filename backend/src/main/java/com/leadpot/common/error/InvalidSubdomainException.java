package com.leadpot.common.error;

/** 서브도메인 형식이 올바르지 않거나 예약어인 경우(400). */
public class InvalidSubdomainException extends RuntimeException {
    public InvalidSubdomainException(String message) {
        super(message);
    }
}
