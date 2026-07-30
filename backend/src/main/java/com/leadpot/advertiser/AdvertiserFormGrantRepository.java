package com.leadpot.advertiser;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AdvertiserFormGrantRepository extends JpaRepository<AdvertiserFormGrant, Long> {

    List<AdvertiserFormGrant> findByAdvertiserId(Long advertiserId);

    /** 리드폼당 최대 1건(UNIQUE 제약) — 그 폼이 이미 누군가에게 부여됐는지 확인용. */
    Optional<AdvertiserFormGrant> findByFormId(Long formId);

    List<AdvertiserFormGrant> findByFormIdIn(List<Long> formIds);

    long countByAdvertiserId(Long advertiserId);

    void deleteByAdvertiserId(Long advertiserId);
}
