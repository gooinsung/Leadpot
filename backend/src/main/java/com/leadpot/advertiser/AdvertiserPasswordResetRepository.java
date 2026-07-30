package com.leadpot.advertiser;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AdvertiserPasswordResetRepository extends JpaRepository<AdvertiserPasswordReset, Long> {

    Optional<AdvertiserPasswordReset> findByTokenHash(String tokenHash);

    /** 새 링크 발급 시 기존 미사용 링크를 무효화하기 위해 조회. */
    List<AdvertiserPasswordReset> findByAdvertiserIdAndUsedAtIsNull(Long advertiserId);
}
