package com.leadpot.event;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface InteractionEventRepository extends JpaRepository<InteractionEvent, Long> {

    /** 통계용: 소유자 + 기간(반열림 [from, to)) 이벤트 로드. */
    List<InteractionEvent> findByOwnerIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
            Long ownerId, Instant from, Instant to);
}
