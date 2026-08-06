package com.leadpot.advertiser.dto;

/**
 * 광고주가 자기 접수 알림 수신번호를 등록·변경할 때 보내는 요청(V28).
 * <p>
 * 빈 값·null 이면 등록을 해제하고 발송을 멈춘다. 하이픈이 섞여 있어도 서버에서 정규화한다.
 */
public record NotifyPhoneRequest(String phone) {
}
