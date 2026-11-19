package com.leadpot.adautomation.run;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdActionLogRepository extends JpaRepository<AdActionLog, Long> {

    List<AdActionLog> findByOwnerIdOrderByIdDesc(Long ownerId, Pageable pageable);
}
