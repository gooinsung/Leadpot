package com.leadpot.lead.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.leadpot.lead.Lead;

/** 리드 조회 응답(대시보드/목록). */
public record LeadResponse(
        Long id,
        Long formId,
        List<Map<String, Object>> answers,
        List<Map<String, Object>> consents,
        String status,
        boolean phoneVerified,
        String submitterIp,
        String device,
        String os,
        String browser,
        String language,
        String referer,
        Map<String, Object> utm,
        List<String> tags,
        /** 분야(V35) — 접수 시점 도장 또는 일괄 지정. null = 없음. */
        String category,
        Instant createdAt,
        /** 필터·라벨 키(고정=코드, 커스텀=C{id}). 통합 축 V29. */
        String statusKey,
        Long customStatusId,
        /** 광고주가 이 리드를 처음 열어본 시각. null 이면 아직 안 봤다는 뜻(목록의 '광고주 확인' 표시). */
        Instant advertiserSeenAt,
        /** <b>마케터</b>가 열어본 시각. null 이면 '미확인'. 리드 상태와 무관하다(V32). */
        Instant seenAt,
        /** 아웃바운드 웹훅(외부 API 전달) 최신 시도 결과. SUCCESS/FAILED, null = 시도한 적 없음. */
        String outboundWebhookStatus,
        Integer outboundWebhookCode,
        String outboundWebhookResponse,
        Instant outboundWebhookSentAt) {

    public static LeadResponse from(Lead l) {
        return new LeadResponse(
                l.getId(),
                l.getFormId(),
                l.getAnswers(),
                l.getConsents(),
                l.getStatus(),
                l.isPhoneVerified(),
                l.getSubmitterIp(),
                l.getDevice(),
                l.getOs(),
                l.getBrowser(),
                l.getLanguage(),
                l.getReferer(),
                l.getUtm(),
                l.getTags(),
                l.getCategory(),
                l.getCreatedAt(),
                l.statusKey(),
                l.getCustomStatusId(),
                l.getAdvertiserSeenAt(),
                l.getSeenAt(),
                l.getOutboundWebhookStatus(),
                l.getOutboundWebhookCode(),
                l.getOutboundWebhookResponse(),
                l.getOutboundWebhookSentAt());
    }
}
