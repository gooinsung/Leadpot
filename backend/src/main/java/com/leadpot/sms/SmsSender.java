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
     *
     * @param imageId 대행사에 올려둔 첨부 이미지 id. 있으면 MMS 로 나간다(없으면 null)
     */
    SmsResult send(SmsCredentials cred, String to, String text, String imageId);

    /** 첨부 없는 발송. */
    default SmsResult send(SmsCredentials cred, String to, String text) {
        return send(cred, to, text, null);
    }

    /**
     * 첨부 이미지를 대행사 저장소에 올리고 id 를 받는다. 한 번 올리면 여러 번 재사용할 수 있어
     * 발송 때마다 올리지 않고 <b>리드폼 저장 시 한 번만</b> 올린다.
     *
     * @param jpeg {@link SmsImages} 로 규격을 맞춘 JPG 바이트
     */
    UploadResult upload(SmsCredentials cred, byte[] jpeg, String name);

    /** 발송 결과. 성공하면 {@code error} 가 null 이다. */
    record SmsResult(boolean ok, String providerMessageId, String error, String channel) {

        public static SmsResult sent(String messageId, String channel) {
            return new SmsResult(true, messageId, null, channel);
        }

        public static SmsResult failed(String error, String channel) {
            return new SmsResult(false, null, error, channel);
        }
    }

    /** 첨부 업로드 결과. 성공하면 {@code fileId} 가 채워진다. */
    record UploadResult(boolean ok, String fileId, String error) {

        public static UploadResult ok(String fileId) {
            return new UploadResult(true, fileId, null);
        }

        public static UploadResult failed(String error) {
            return new UploadResult(false, null, error);
        }
    }
}
