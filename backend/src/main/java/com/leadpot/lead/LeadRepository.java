package com.leadpot.lead;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LeadRepository extends JpaRepository<Lead, Long> {

    // 활성 리드(휴지통 제외) — 목록·CSV
    List<Lead> findByFormIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long formId);

    // 휴지통 리드
    List<Lead> findByFormIdAndDeletedAtIsNotNullOrderByCreatedAtDesc(Long formId);

    long countByFormId(Long formId);

    // 중복 방지: 기간 내 활성 리드(항목 값 대조용). 휴지통 리드는 중복으로 보지 않음.
    List<Lead> findByFormIdAndCreatedAtGreaterThanEqualAndDeletedAtIsNull(Long formId, java.time.Instant after);

    // 중복 방지: 기간 내 동일 IP 활성 제출 존재 여부
    boolean existsByFormIdAndSubmitterIpAndCreatedAtGreaterThanEqualAndDeletedAtIsNull(Long formId, String ip, java.time.Instant after);

    // 본인 소유 리드폼들의 전체 활성 리드 수 (대시보드용, K5)
    @Query("select count(l) from Lead l where l.formId in (select f.id from Form f where f.ownerId = :ownerId) "
            + "and l.deletedAt is null")
    long countByOwner(@Param("ownerId") Long ownerId);

    // 본인 소유 리드폼들의 전체 활성 리드 (통계 집계용)
    @Query("select l from Lead l where l.formId in (select f.id from Form f where f.ownerId = :ownerId) "
            + "and l.deletedAt is null")
    List<Lead> findAllByOwner(@Param("ownerId") Long ownerId);

    // 본인 소유 활성 리드 + 기간(반열림 [from, to)) — 통계 필터용
    @Query("select l from Lead l where l.formId in (select f.id from Form f where f.ownerId = :ownerId) "
            + "and l.deletedAt is null and l.createdAt >= :from and l.createdAt < :to")
    List<Lead> findByOwnerBetween(@Param("ownerId") Long ownerId,
            @Param("from") java.time.Instant from, @Param("to") java.time.Instant to);
}
