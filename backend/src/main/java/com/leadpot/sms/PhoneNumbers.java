package com.leadpot.sms;

/** 전화번호 정규화·마스킹. 솔라피는 하이픈 없는 숫자만 받는다. */
public final class PhoneNumbers {

    private PhoneNumbers() {
    }

    /**
     * 발송용 정규화 — 숫자만 남긴다. 국가번호(+82·82)로 시작하면 국내 형식(0…)으로 바꾼다.
     * 형식이 아니면 null(발송하지 않고 SKIPPED 로 남기기 위해).
     */
    public static String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String digits = raw.replaceAll("[^0-9]", "");
        if (digits.startsWith("82") && digits.length() >= 11) {
            digits = "0" + digits.substring(2);
        }
        // 국내 유·무선 번호 길이(지역번호 포함 9~11자리)
        if (digits.length() < 9 || digits.length() > 11 || !digits.startsWith("0")) {
            return null;
        }
        return digits;
    }

    /** 이력 저장용 마스킹 — 뒤 4자리를 가린다. 원본 번호를 로그에 쌓아둘 이유가 없다. */
    public static String mask(String raw) {
        String digits = raw == null ? "" : raw.replaceAll("[^0-9]", "");
        if (digits.length() < 5) {
            return digits.isEmpty() ? "" : "·".repeat(digits.length());
        }
        return digits.substring(0, digits.length() - 4) + "····";
    }
}
