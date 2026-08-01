package com.leadpot.sms;

/**
 * 문자 발송 대행사 어댑터. 지금은 솔라피 하나지만, 단가를 중시하는 마케터용으로
 * 알리고 등을 추가할 수 있게 인터페이스로 둔다(docs/MESSAGING-PLAN.md §10).
 */
public interface SmsSender {

    /** 대행사 식별자(로그·설정에 저장하는 값). */
    String provider();

    /**
     * 문자 1건 발송. 예외를 던지지 않고 실패도 {@link SmsResult} 로 돌려준다 —
     * 자동 발송이 리드 접수를 방해하면 안 되기 때문이다.
     */
    SmsResult send(SmsCredentials cred, String to, String text);

    /** 발송 결과. 성공하면 {@code error} 가 null 이다. */
    record SmsResult(boolean ok, String providerMessageId, String error, String channel) {

        public static SmsResult sent(String messageId, String channel) {
            return new SmsResult(true, messageId, null, channel);
        }

        public static SmsResult failed(String error, String channel) {
            return new SmsResult(false, null, error, channel);
        }
    }
}
