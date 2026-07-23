package com.leadpot.lead;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LeadRepository extends JpaRepository<Lead, Long> {

    List<Lead> findByFormIdOrderByCreatedAtDesc(Long formId);

    long countByFormId(Long formId);

    // 본인 소유 폼들의 전체 리드 수 (대시보드용, K5)
    @Query("select count(l) from Lead l where l.formId in (select f.id from Form f where f.ownerId = :ownerId)")
    long countByOwner(@Param("ownerId") Long ownerId);
}
