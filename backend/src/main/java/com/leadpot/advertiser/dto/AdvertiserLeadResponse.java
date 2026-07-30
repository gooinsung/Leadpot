package com.leadpot.advertiser.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.leadpot.advertiser.AdvertiserLeadStatus;
import com.leadpot.lead.Lead;

/**
 * 광고주에게 보내는 리드 응답. <b>기존 {@code LeadResponse} 를 재사용하지 않는 것이 핵심</b>이다.
 * <p>
 * 재사용하면 나중에 {@code Lead} 에 필드가 추가될 때 <b>자동으로 광고주에게 노출</b>된다.
 * 여기서는 보여줄 필드만 손으로 나열해서(화이트리스트) 그런 사고를 구조적으로 막는다.
 * <p>
 * <b>절대 넣지 말 것</b>(사용자 확정): submitterIp · userAgent · device · os · browser ·
 * language · referer · utm · tags · status(마케터 분류) · landingPageId · deletedAt · consents.
 */
public record AdvertiserLeadResponse(
        Long id,
        /** 리드폼 답변(광고주가 실제로 필요한 데이터). */
        List<Map<String, Object>> answers,
        Instant createdAt,
        /** 광고주 관점 상태. null 이면 아직 미확인이므로 NEW 로 내려준다. */
        String advertiserStatus,
        String advertiserStatusLabel,
        Instant advertiserSeenAt) {

    public static AdvertiserLeadResponse from(Lead lead) {
        String status = lead.getAdvertiserStatus() == null ? AdvertiserLeadStatus.NEW : lead.getAdvertiserStatus();
        return new AdvertiserLeadResponse(
                lead.getId(),
                lead.getAnswers(),
                lead.getCreatedAt(),
                status,
                AdvertiserLeadStatus.label(status),
                lead.getAdvertiserSeenAt());
    }
}
