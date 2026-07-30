package com.leadpot.advertiser.dto;

import java.util.List;

/** 광고주 리드 목록(페이징). 한 번에 가져갈 수 있는 양을 서버가 제한한다. */
public record AdvertiserLeadPage(
        List<AdvertiserLeadResponse> items,
        long total,
        int page,
        int size) {
}
