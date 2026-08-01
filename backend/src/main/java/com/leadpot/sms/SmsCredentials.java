package com.leadpot.sms;

/**
 * 문자 발송에 쓸 자격증명 한 벌.
 *
 * @param apiKey    대행사 API 키
 * @param apiSecret 대행사 API 시크릿(서명에만 쓰고 외부로 내보내지 않는다)
 * @param senderPhone 발신번호 — 이 계정에 사전등록된 번호여야 한다(전기통신사업법)
 * @param system    리드팟 계정 키인가. true 면 우리 비용이라 플랜 한도 검사 대상이다
 */
public record SmsCredentials(String apiKey, String apiSecret, String senderPhone, boolean system) {

    public boolean usable() {
        return notBlank(apiKey) && notBlank(apiSecret) && notBlank(senderPhone);
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
