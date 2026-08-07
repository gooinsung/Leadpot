package com.leadpot.advertiser.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadStatuses;

/**
 * 광고주에게 보내는 리드 응답. <b>기존 {@code LeadResponse} 를 재사용하지 않는 것이 핵심</b>이다.
 * <p>
 * 재사용하면 나중에 {@code Lead} 에 필드가 추가될 때 <b>자동으로 광고주에게 노출</b>된다.
 * 여기서는 보여줄 필드만 손으로 나열해서(화이트리스트) 그런 사고를 구조적으로 막는다.
 * <p>
 * <b>절대 넣지 말 것</b>(사용자 확정): submitterIp · userAgent · device · os · browser ·
 * language · referer · utm · tags · landingPageId · deletedAt · consents.
 * <p>
 * 상태는 V29 부터 마케터와 공유하는 단일 축이라 그대로 노출한다.
 */
public record AdvertiserLeadResponse(
        Long id,
        /** 리드폼 답변(광고주가 실제로 필요한 데이터). */
        List<Map<String, Object>> answers,
        Instant createdAt,
        /** 통합 진행상태 코드(NEW/VALID/AS_REQUESTED/INVALID/CUSTOM). */
        String status,
        /** 필터·표시 키(고정=코드, 커스텀=C{id}). */
        String statusKey,
        Long customStatusId,
        String statusLabel,
        Instant advertiserSeenAt) {

    /** @param customName status=CUSTOM 일 때의 정의 이름(호출부가 조회). 그 외 null. */
    public static AdvertiserLeadResponse from(Lead lead, String customName) {
        return new AdvertiserLeadResponse(
                lead.getId(),
                lead.getAnswers(),
                lead.getCreatedAt(),
                lead.getStatus(),
                lead.statusKey(),
                lead.getCustomStatusId(),
                LeadStatuses.label(lead.getStatus(), customName),
                lead.getAdvertiserSeenAt());
    }
}
