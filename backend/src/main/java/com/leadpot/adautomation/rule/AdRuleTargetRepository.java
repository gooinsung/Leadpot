package com.leadpot.adautomation.rule;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AdRuleTargetRepository extends JpaRepository<AdRuleTarget, Long> {

    List<AdRuleTarget> findByRuleIdOrderByIdAsc(Long ruleId);

    List<AdRuleTarget> findByRuleIdIn(Collection<Long> ruleIds);

    List<AdRuleTarget> findByConnectionId(Long connectionId);

    @Modifying
    @Query("delete from AdRuleTarget t where t.ruleId = :ruleId")
    void deleteByRuleId(@Param("ruleId") Long ruleId);

    @Modifying
    @Query("delete from AdRuleTarget t where t.connectionId = :connectionId")
    void deleteByConnectionId(@Param("connectionId") Long connectionId);
}
