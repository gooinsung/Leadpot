package com.leadpot.advertiser.dto;

/**
 * 리드폼 편집 화면에서 마케터에게 보여줄 <b>광고주 접수 알림 수신 상태</b>(V28).
 *
 * <p>마케터는 광고주 번호를 직접 넣을 수 없다 — 광고주가 포털에서 본인이 등록해야 발송된다
 * (수신 동의 근거, docs/MESSAGING-PLAN.md §9). 그래서 마케터에게는 "지금 보낼 수 있는 상태인지"만 알려준다.
 *
 * @param linked        이 리드폼에 광고주 계정이 연결돼 있는지
 * @param advertiserName 연결된 광고주 표시 이름(없으면 null)
 * @param registered    지금 실제로 발송되는 상태인지 — 번호가 있고 이 폼이 꺼져 있지 않아야 true
 * @param phoneMasked   실제 발송 번호의 마스킹 값(뒤 4자리 가림). 발송 불가면 null.
 *                      ⚠️ 원본을 내려주지 않는다 — 마케터가 광고주 번호를 수집하는 통로가 되면 안 된다.
 * @param source        번호 출처(V33). {@link #SOURCE_FORM} = 이 폼 전용 번호,
 *                      {@link #SOURCE_ACCOUNT} = 광고주 계정 기본 번호, {@link #SOURCE_NONE} = 없음
 * @param disabledByAdvertiser 광고주가 <b>이 폼만</b> 알림을 끈 상태인지(V33).
 *                      번호 미등록과 구분해서 안내해야 한다 — 마케터가 할 수 있는 조치가 다르다.
 */
public record AdvertiserNotifyStatus(
        boolean linked,
        String advertiserName,
        boolean registered,
        String phoneMasked,
        String source,
        boolean disabledByAdvertiser) {

    /** 이 리드폼에만 지정된 전용 번호로 발송된다. */
    public static final String SOURCE_FORM = "FORM";
    /** 광고주 계정 기본 번호로 발송된다(배정된 모든 폼 공통). */
    public static final String SOURCE_ACCOUNT = "ACCOUNT";
    /** 보낼 번호가 없다. */
    public static final String SOURCE_NONE = "NONE";

    public static AdvertiserNotifyStatus notLinked() {
        return new AdvertiserNotifyStatus(false, null, false, null, SOURCE_NONE, false);
    }
}
