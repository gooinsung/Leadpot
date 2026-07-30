package com.leadpot.common.error;

/** 요금제 한도 초과(예: 플랜당 광고주 계정 수). */
public class PlanLimitExceededException extends RuntimeException {

    public PlanLimitExceededException(String message) {
        super(message);
    }
}
