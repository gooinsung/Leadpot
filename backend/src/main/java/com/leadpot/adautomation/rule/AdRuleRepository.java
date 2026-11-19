package com.leadpot.adautomation.rule;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface AdRuleRepository extends JpaRepository<AdRule, Long> {

    List<AdRule> findByOwnerIdOrderByIdDesc(Long ownerId);

    Optional<AdRule> findByIdAndOwnerId(Long id, Long ownerId);

    /** 접수 신호 때 — 이 리드폼의 실행 가능한 규칙(켜짐 + 일시정지 아님). ix_ad_rules_form 사용. */
    @Query("select r from AdRule r where r.formId = :formId and r.enabled = true and r.pausedReason is null")
    List<AdRule> findRunnableByFormId(@Param("formId") Long formId);

    List<AdRule> findByIdIn(Collection<Long> ids);

    /**
     * 기간당 1회 선점. 이 기간에 아직 발동하지 않았을 때만 1행을 바꾼다 — 같은 순간 접수 2건이 와도 한 번만 발동.
     *
     * @return 1 이면 이번 호출이 발동권을 얻었다
     */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update AdRule r set r.lastFiredPeriod = :period, r.lastFiredAt = :at "
            + "where r.id = :id and (r.lastFiredPeriod is null or r.lastFiredPeriod <> :period)")
    int claimPeriod(@Param("id") Long id, @Param("period") String period, @Param("at") Instant at);

    /**
     * 조건 평가용 리드 수 — 휴지통 제외 전부(수기·엑셀 포함, 결정 4). leads 의 기존 인덱스를 탄다.
     * ⚠️ 읽기 전용. 리드 테이블에 쓰지 않는다.
     */
    @Query("select count(l) from com.leadpot.lead.Lead l "
            + "where l.formId = :formId and l.deletedAt is null and l.createdAt >= :since")
    long countLeadsSince(@Param("formId") Long formId, @Param("since") Instant since);
}
