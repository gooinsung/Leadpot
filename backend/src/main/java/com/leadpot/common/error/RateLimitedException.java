package com.leadpot.common.error;

/** 요청량 제한 초과(429). 예: 리드폼의 인바운드 웹훅에 짧은 시간에 너무 많은 요청이 들어온 경우. */
public class RateLimitedException extends RuntimeException {

    public RateLimitedException(String message) {
        super(message);
    }
}
