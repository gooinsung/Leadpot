package com.leadpot.advertiser.dto;

import java.util.List;
import java.util.Map;

/**
 * 마케터가 광고주 화면을 <b>읽기 전용</b>으로 미리보기할 때의 진입 데이터.
 * 광고주가 로그인해서 보는 것과 같은 폼 목록·대시보드를 담는다.
 */
public record AdvertiserPreviewResponse(
        Long advertiserId,
        String advertiserName,
        String advertiserCompany,
        List<AdvertiserFormResponse> forms,
        Map<String, Object> dashboard) {
}
