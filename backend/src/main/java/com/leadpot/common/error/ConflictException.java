package com.leadpot.common.error;

/**
 * 리소스 상태 충돌(409). 예: 이미 다른 광고주에게 부여된 리드폼을 다시 부여하려는 경우,
 * 같은 이메일로 대기 중인 초대가 이미 있는 경우.
 */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
