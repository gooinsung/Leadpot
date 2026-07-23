package com.leadpot.common.error;

/** 리소스를 찾을 수 없거나 접근 권한이 없는 경우(존재 여부를 숨기기 위해 404 로 통일). */
public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) {
        super(message);
    }
}
