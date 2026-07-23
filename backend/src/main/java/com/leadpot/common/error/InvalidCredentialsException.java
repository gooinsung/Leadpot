package com.leadpot.common.error;

/** 이메일/비밀번호가 일치하지 않는 경우. */
public class InvalidCredentialsException extends RuntimeException {
    public InvalidCredentialsException(String message) {
        super(message);
    }
}
