package com.leadpot.advertiser.dto;

import java.time.Instant;

import com.leadpot.advertiser.AdvertiserAccessLog;

/**
 * 마케터 화면에 보여줄 광고주 활동 이력 한 줄. 개인정보 취급 추적 + §5 분쟁 방어의 증거.
 * 액션은 한글 라벨로 함께 내려 화면에서 그대로 쓴다.
 */
public record AdvertiserLogResponse(
        Long id,
        String action,
        String actionLabel,
        Long formId,
        Long leadId,
        String detail,
        String ip,
        Instant createdAt) {

    public static AdvertiserLogResponse from(AdvertiserAccessLog l) {
        return new AdvertiserLogResponse(
                l.getId(), l.getAction(), label(l.getAction()),
                l.getFormId(), l.getLeadId(), l.getDetail(), l.getIp(), l.getCreatedAt());
    }

    private static String label(String action) {
        if (action == null) {
            return "";
        }
        return switch (action) {
            case AdvertiserAccessLog.ACTION_LOGIN -> "로그인";
            case AdvertiserAccessLog.ACTION_VIEW_LEAD -> "리드 열람";
            case AdvertiserAccessLog.ACTION_EXPORT -> "내보내기";
            case AdvertiserAccessLog.ACTION_STATUS -> "상태 변경";
            case AdvertiserAccessLog.ACTION_MEMO -> "메모";
            case AdvertiserAccessLog.ACTION_IMPERSONATE -> "대리 열람";
            default -> action;
        };
    }
}
