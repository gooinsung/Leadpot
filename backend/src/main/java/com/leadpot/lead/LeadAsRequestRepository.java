package com.leadpot.lead;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface LeadAsRequestRepository extends JpaRepository<LeadAsRequest, Long> {

    /** 처리 대기 중인 요청(동시에 하나만 존재해야 한다 — 서비스가 보장). */
    Optional<LeadAsRequest> findByLeadIdAndStatus(Long leadId, String status);

    /** 이 리드의 요청 이력(최신순) — 화면에서 사유·증빙·처리 결과를 보여준다. */
    List<LeadAsRequest> findByLeadIdOrderByCreatedAtDesc(Long leadId);

    /** 리포트용 — 주어진 리드들에 걸린 AS 요청 전부(리드 하나에 여러 건일 수 있다, 거부 후 재요청). */
    List<LeadAsRequest> findByLeadIdIn(List<Long> leadIds);
}
