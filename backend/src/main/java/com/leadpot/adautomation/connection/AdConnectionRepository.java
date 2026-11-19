package com.leadpot.adautomation.connection;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AdConnectionRepository extends JpaRepository<AdConnection, Long> {

    List<AdConnection> findByOwnerIdOrderByIdAsc(Long ownerId);

    Optional<AdConnection> findByIdAndOwnerId(Long id, Long ownerId);
}
