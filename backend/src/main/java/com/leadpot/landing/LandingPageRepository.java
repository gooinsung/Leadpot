package com.leadpot.landing;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface LandingPageRepository extends JpaRepository<LandingPage, Long> {

    List<LandingPage> findByOwnerIdOrderByUpdatedAtDesc(Long ownerId);

    Optional<LandingPage> findByIdAndOwnerId(Long id, Long ownerId);

    Optional<LandingPage> findBySlug(String slug);

    Optional<LandingPage> findBySlugAndOwnerId(String slug, Long ownerId);

    boolean existsBySlug(String slug);
}
