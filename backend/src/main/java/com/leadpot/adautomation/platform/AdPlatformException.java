package com.leadpot.adautomation.platform;

/**
 * 매체 API 호출 실패. {@link Kind} 로 원인을 나눠 상위(이력·알림·연결 상태)가 매체를 몰라도 판단하게 한다.
 * 메시지는 마케터에게 그대로 보여줄 수 있는 한국어로 만든다(키·토큰 원문 금지).
 */
public class AdPlatformException extends RuntimeException {

    public enum Kind {
        /** 키·토큰이 무효(재발급·폐기·권한 회수). 연결을 INVALID 로 바꾼다. */
        AUTH_INVALID,
        /** 매체 호출 한도 초과(429 등). */
        RATE_LIMITED,
        /** 캠페인·광고계정이 없거나 이 키로 접근할 수 없음. */
        NOT_FOUND,
        /** 네트워크·시간 초과·매체 5xx — 일시적일 수 있음. */
        TEMPORARY,
        /** 그 외(요청 거절 등). */
        OTHER
    }

    private final Kind kind;

    public AdPlatformException(Kind kind, String message) {
        super(message);
        this.kind = kind;
    }

    public AdPlatformException(Kind kind, String message, Throwable cause) {
        super(message, cause);
        this.kind = kind;
    }

    public Kind kind() {
        return kind;
    }
}
