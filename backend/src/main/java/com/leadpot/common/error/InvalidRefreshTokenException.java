package com.leadpot.common.error;

/** 리프레시 토큰이 유효하지 않은 경우. */
public class InvalidRefreshTokenException extends RuntimeException {
    public InvalidRefreshTokenException(String message) {
        super(message);
    }
}
