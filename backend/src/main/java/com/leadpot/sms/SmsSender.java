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
     * 알림톡 1건 발송(마케터·광고주 접수 알림). 지원하지 않는 대행사는 실패로 돌려준다.
     *
     * <p><b>본문은 우리가 만들지 않는다</b> — 카카오 심사본이 그대로 나가고 우리는 변수만 채운다.
     * 본문이 심사본과 달라지면 대행사가 발송을 거부한다(docs/MESSAGING-PLAN.md §9).
     *
     * @param fallbackText 알림톡 실패 시 대체발송할 문자 본문. <b>지금은 대체발송을 끄므로 쓰이지 않지만</b>
     *                     (사용자 결정 2026-08-10), 켜는 순간 필요해지고 대행사 규격상 필수라 함께 넘긴다
     */
    default SmsResult sendAlimtalk(SmsCredentials cred, String to, Alimtalk options, String fallbackText) {
        return SmsResult.failed("이 대행사는 알림톡을 지원하지 않습니다.", SmsPermissions.ATA);
    }

    /**
     * 첨부 이미지를 대행사 저장소에 올리고 id 를 받는다. 한 번 올리면 여러 번 재사용할 수 있어
     * 발송 때마다 올리지 않고 <b>리드폼 저장 시 한 번만</b> 올린다.
     *
     * @param jpeg {@link SmsImages} 로 규격을 맞춘 JPG 바이트
     */
    UploadResult upload(SmsCredentials cred, byte[] jpeg, String name);

    /**
     * 알림톡 발송에 필요한 값들.
     *
     * @param pfId       카카오 채널 연동 아이디(KA01PF…). 환경변수로 주입한다
     * @param templateId 승인된 템플릿 아이디(KA01TP…). 환경변수로 주입한다
     * @param variables  치환할 변수. 키는 {@code "#{담당역할}"} 처럼 <b>중괄호까지 포함한 형태</b>다.
     *                   ⚠️ 값이 비면 그 건은 대행사가 실패 처리하므로 호출부가 기본값을 보장해야 한다
     */
    record Alimtalk(String pfId, String templateId, java.util.Map<String, String> variables) {
    }

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
