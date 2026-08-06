package com.leadpot.advertiser.dto;

/**
 * 리드폼 편집 화면에서 마케터에게 보여줄 <b>광고주 접수 알림 수신 상태</b>(V28).
 *
 * <p>마케터는 광고주 번호를 직접 넣을 수 없다 — 광고주가 포털에서 본인이 등록해야 발송된다
 * (수신 동의 근거, docs/MESSAGING-PLAN.md §9). 그래서 마케터에게는 "지금 보낼 수 있는 상태인지"만 알려준다.
 *
 * @param linked        이 리드폼에 광고주 계정이 연결돼 있는지
 * @param advertiserName 연결된 광고주 표시 이름(없으면 null)
 * @param registered    광고주가 수신번호를 등록했는지 — {@code true} 여야 실제로 발송된다
 * @param phoneMasked   등록된 번호의 마스킹 값(뒤 4자리 가림). 미등록이면 null.
 *                      ⚠️ 원본을 내려주지 않는다 — 마케터가 광고주 번호를 수집하는 통로가 되면 안 된다.
 */
public record AdvertiserNotifyStatus(
        boolean linked,
        String advertiserName,
        boolean registered,
        String phoneMasked) {

    public static AdvertiserNotifyStatus notLinked() {
        return new AdvertiserNotifyStatus(false, null, false, null);
    }
}
