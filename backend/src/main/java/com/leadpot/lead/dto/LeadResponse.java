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
        Instant createdAt,
        /** 광고주 관점 상태(광고주가 부여된 폼일 때만 의미 있음). null = 아직 변경 없음. */
        String advertiserStatus,
        /** 광고주가 이 리드를 처음 열어본 시각. null 이면 아직 안 봤다는 뜻(목록의 '광고주 확인' 표시). */
        Instant advertiserSeenAt) {

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
                l.getCreatedAt(),
                l.getAdvertiserStatus(),
                l.getAdvertiserSeenAt());
    }
}
