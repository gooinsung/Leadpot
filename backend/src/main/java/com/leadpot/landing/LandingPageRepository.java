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

    /**
     * 예열(warm-up)이 데울 대표 랜딩 1건. 공개 경로를 태워야 하므로 published 만 고른다.
     * 최근 수정된 것을 쓰는 이유는 실제로 트래픽이 오는 랜딩일 가능성이 높기 때문(선택 기준일 뿐 기능 의미는 없다).
     */
    Optional<LandingPage> findFirstByStatusOrderByUpdatedAtDesc(String status);
}
