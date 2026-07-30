package com.leadpot.auth;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    Optional<User> findBySubdomain(String subdomain);

    boolean existsBySubdomain(String subdomain);

    // --- 광고주 하위계정 (parent_user_id = 소유 마케터) ---

    List<User> findByParentUserIdAndRoleOrderByCreatedAtDesc(Long parentUserId, Role role);

    /** 소유 마케터 확인까지 겸하는 조회 — 남의 광고주면 빈 값(404 처리). */
    Optional<User> findByIdAndParentUserIdAndRole(Long id, Long parentUserId, Role role);

    long countByParentUserIdAndRole(Long parentUserId, Role role);
}
