package com.leadpot.form;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FormRepository extends JpaRepository<Form, Long> {

    List<Form> findByOwnerIdOrderByUpdatedAtDesc(Long ownerId);

    // 소유자 본인 리드폼만 조회 (K5 접근권한)
    Optional<Form> findByIdAndOwnerId(Long id, Long ownerId);
}
