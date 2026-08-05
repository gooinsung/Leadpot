package com.leadpot.admin.dto;

import java.time.Instant;
import java.util.List;

import com.leadpot.auth.Plan;
import com.leadpot.auth.Role;

/**
 * 어드민 계정 목록의 한 줄.
 *
 * <p>⚠️ <b>고객 개인정보(리드 내용·연락처)는 담지 않는다.</b> 어드민 화면의 목적은
 * 계정·권한 관리이고, 우리는 리드에 대해 수탁자 위치다. 규모 파악용으로 <b>건수만</b> 노출한다.
 *
 * @param monthlyLimit 월 문자 발송 상한. <b>0 = 금지, -1 = 무제한</b> (V25)
 */
public record AdminUserRow(
        Long id,
        String email,
        String name,
        Role role,
        Plan plan,
        boolean active,
        String subdomain,
        Instant createdAt,
        long formCount,
        long leadCount,
        boolean smsEnabled,
        List<String> smsAllowedChannels,
        int monthlyLimit,
        long smsUsedThisMonth) {
}
