package com.leadpot.common.error;

/** 이미 가입된 이메일로 회원가입을 시도한 경우. */
public class EmailAlreadyUsedException extends RuntimeException {
    public EmailAlreadyUsedException(String message) {
        super(message);
    }
}
