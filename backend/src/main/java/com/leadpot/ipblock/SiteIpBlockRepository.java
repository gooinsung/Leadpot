package com.leadpot.ipblock;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SiteIpBlockRepository extends JpaRepository<SiteIpBlock, Long> {

    List<SiteIpBlock> findByUserIdOrderByCreatedAtDesc(Long userId);
}
