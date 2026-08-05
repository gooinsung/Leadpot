package com.leadpot.admin.dto;

import java.time.Instant;

import com.leadpot.admin.AdminAuditLog;

/** 어드민 변경 이력 한 줄. 이메일은 추적에 필요해 담지만 그 밖의 개인정보는 담지 않는다. */
public record AdminAuditRow(Long id, Long adminId, String adminEmail, Long targetId,
        String targetEmail, String action, String detail, Instant createdAt) {

    public static AdminAuditRow of(AdminAuditLog log, String adminEmail, String targetEmail) {
        return new AdminAuditRow(log.getId(), log.getAdminId(), adminEmail, log.getTargetId(),
                targetEmail, log.getAction(), log.getDetail(), log.getCreatedAt());
    }
}
