package com.leadpot.auth;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PasswordResetCodeRepository extends JpaRepository<PasswordResetCode, Long> {

    /** 계정의 최신 코드(사용 여부 무관 — 쿨다운·검증 둘 다 최신 한 건만 본다). */
    Optional<PasswordResetCode> findTopByUserIdOrderByCreatedAtDesc(Long userId);

    /** 재요청 시 무효화할 미사용 코드들. */
    List<PasswordResetCode> findByUserIdAndUsedAtIsNull(Long userId);

    /** 하루 발송 상한 검사용(문자 비용 방어). */
    long countByUserIdAndCreatedAtAfter(Long userId, java.time.Instant after);
}
