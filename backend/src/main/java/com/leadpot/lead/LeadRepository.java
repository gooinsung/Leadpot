package com.leadpot.lead;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LeadRepository extends JpaRepository<Lead, Long> {

    List<Lead> findByFormIdOrderByCreatedAtDesc(Long formId);

    long countByFormId(Long formId);

    // 중복 방지: 기간 내 리드(항목 값 대조용)
    List<Lead> findByFormIdAndCreatedAtGreaterThanEqual(Long formId, java.time.Instant after);

    // 중복 방지: 기간 내 동일 IP 제출 존재 여부
    boolean existsByFormIdAndSubmitterIpAndCreatedAtGreaterThanEqual(Long formId, String ip, java.time.Instant after);

    // 본인 소유 폼들의 전체 리드 수 (대시보드용, K5)
    @Query("select count(l) from Lead l where l.formId in (select f.id from Form f where f.ownerId = :ownerId)")
    long countByOwner(@Param("ownerId") Long ownerId);

    // 본인 소유 폼들의 전체 리드 (통계 집계용)
    @Query("select l from Lead l where l.formId in (select f.id from Form f where f.ownerId = :ownerId)")
    List<Lead> findAllByOwner(@Param("ownerId") Long ownerId);

    // 본인 소유 리드 + 기간(반열림 [from, to)) — 통계 필터용
    @Query("select l from Lead l where l.formId in (select f.id from Form f where f.ownerId = :ownerId) "
            + "and l.createdAt >= :from and l.createdAt < :to")
    List<Lead> findByOwnerBetween(@Param("ownerId") Long ownerId,
            @Param("from") java.time.Instant from, @Param("to") java.time.Instant to);
}
