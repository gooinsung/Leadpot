package com.leadpot.admin;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, Long> {

    List<AdminAuditLog> findByOrderByCreatedAtDesc(Pageable pageable);

    List<AdminAuditLog> findByTargetIdOrderByCreatedAtDesc(Long targetId, Pageable pageable);
}
