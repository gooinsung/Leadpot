package com.leadpot.common.error;

/** 공개 리드폼 제출 값이 유효하지 않은 경우(필수 항목/필수 동의 누락 등). */
public class InvalidSubmissionException extends RuntimeException {
    public InvalidSubmissionException(String message) {
        super(message);
    }
}
