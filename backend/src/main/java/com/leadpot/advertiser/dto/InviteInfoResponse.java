package com.leadpot.advertiser.dto;

/**
 * 초대 링크를 열었을 때 보여줄 정보 (비로그인 공개 응답).
 * <p>
 * 링크 소지자에게만 노출되지만, 그래도 최소한만 담는다 —
 * 마케터의 이메일·연락처나 리드폼 목록 같은 건 넣지 않는다.
 */
public record InviteInfoResponse(
        String email,
        String name,
        String company,
        String marketerName,
        String marketerCompany) {
}
