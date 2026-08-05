package com.leadpot.form;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FormRepository extends JpaRepository<Form, Long> {

    List<Form> findByOwnerIdOrderByUpdatedAtDesc(Long ownerId);

    // 소유자 본인 리드폼만 조회 (K5 접근권한)
    Optional<Form> findByIdAndOwnerId(Long id, Long ownerId);

    /**
     * 계정별 리드폼 수 — 어드민 계정 목록용. 계정마다 따로 세면 왕복이 계정 수만큼 늘어난다
     * (DB 가 원격이라 비싸다). 한 방에 집계한다.
     */
    @org.springframework.data.jpa.repository.Query("select f.ownerId, count(f) from Form f group by f.ownerId")
    List<Object[]> countGroupedByOwner();
}
