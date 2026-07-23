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
        Instant createdAt) {

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
                l.getCreatedAt());
    }
}
