package com.leadpot.ipblock;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SiteIpBlockHitRepository extends JpaRepository<SiteIpBlockHit, Long> {

    List<SiteIpBlockHit> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    void deleteByUserId(Long userId);
}
