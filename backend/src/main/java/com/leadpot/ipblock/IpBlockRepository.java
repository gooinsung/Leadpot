package com.leadpot.ipblock;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface IpBlockRepository extends JpaRepository<IpBlock, Long> {

    List<IpBlock> findByFormIdOrderByCreatedAtDesc(Long formId);
}
