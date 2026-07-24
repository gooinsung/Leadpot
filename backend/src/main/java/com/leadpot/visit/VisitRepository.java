package com.leadpot.visit;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface VisitRepository extends JpaRepository<Visit, Long> {

    /** 통계용: 소유자 + 기간(반열림 [from, to)) 방문 로드. */
    List<Visit> findByOwnerIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
            Long ownerId, Instant from, Instant to);
}
