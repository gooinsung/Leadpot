package com.leadpot.ipblock;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IpBlockHitRepository extends JpaRepository<IpBlockHit, Long> {

    List<IpBlockHit> findByFormIdOrderByCreatedAtDesc(Long formId, Pageable pageable);

    void deleteByFormId(Long formId);
}
