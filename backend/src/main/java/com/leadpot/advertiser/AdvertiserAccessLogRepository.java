package com.leadpot.advertiser;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AdvertiserAccessLogRepository extends JpaRepository<AdvertiserAccessLog, Long> {

    List<AdvertiserAccessLog> findByAdvertiserIdOrderByCreatedAtDesc(Long advertiserId, Pageable pageable);

    /** 광고주별 마지막 로그인 시각(목록 표시용). */
    @Query("select max(l.createdAt) from AdvertiserAccessLog l"
            + " where l.advertiserId = :advertiserId and l.action = 'LOGIN'")
    Instant findLastLoginAt(@Param("advertiserId") Long advertiserId);
}
