package com.leadpot.advertiser;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AdvertiserProfileRepository extends JpaRepository<AdvertiserProfile, Long> {

    List<AdvertiserProfile> findByOwnerIdOrderByCompanyNameAsc(Long ownerId);

    Optional<AdvertiserProfile> findByIdAndOwnerId(Long id, Long ownerId);

    Optional<AdvertiserProfile> findByAdvertiserUserId(Long advertiserUserId);
}
