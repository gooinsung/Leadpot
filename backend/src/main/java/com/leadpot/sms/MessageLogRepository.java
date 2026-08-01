package com.leadpot.sms;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MessageLogRepository extends JpaRepository<MessageLog, Long> {

    List<MessageLog> findByOwnerIdOrderByCreatedAtDesc(Long ownerId, Pageable pageable);

    /**
     * 이번 달 사용량 — 리드팟 키로 실제 발송된 건수만 센다.
     * 마케터가 자기 키로 쏜 건은 우리 비용이 아니라 한도 대상이 아니다(§11).
     */
    @Query("""
            select count(m) from MessageLog m
            where m.ownerId = :ownerId
              and m.systemCredential = true
              and m.status = 'SENT'
              and m.createdAt >= :from
            """)
    long countSystemSentSince(@Param("ownerId") Long ownerId, @Param("from") Instant from);

    /** 규칙별 리드당 1회 원칙 검사(§2 중복 발송). SKIPPED 는 시도한 것으로 보지 않는다. */
    @Query("""
            select count(m) from MessageLog m
            where m.ruleId = :ruleId and m.leadId = :leadId and m.status <> 'SKIPPED'
            """)
    long countAttempts(@Param("ruleId") Long ruleId, @Param("leadId") Long leadId);

    long countByOwnerIdAndStatusAndCreatedAtGreaterThanEqual(Long ownerId, String status, Instant from);
}
