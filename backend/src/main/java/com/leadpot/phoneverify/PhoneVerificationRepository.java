package com.leadpot.phoneverify;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PhoneVerificationRepository extends JpaRepository<PhoneVerification, Long> {

    /** 이 폼·번호로 실제 문자를 보낸 최신 건 — 쿨다운 검사와 인증번호 확인 둘 다 이 한 건만 본다. */
    Optional<PhoneVerification> findTopByFormIdAndPhoneHashAndSmsSentTrueOrderByCreatedAtDesc(Long formId,
            String phoneHash);

    /** 번호별 하루 발송 상한(특정인을 겨냥한 문자 폭탄 방어). 폼과 무관하게 센다. */
    long countByPhoneHashAndSmsSentTrueAndCreatedAtAfter(String phoneHash, Instant after);

    /** IP 별 하루 발송 상한(번호를 바꿔 가며 쏘는 비용 공격 방어). */
    long countByRequesterIpAndSmsSentTrueAndCreatedAtAfter(String requesterIp, Instant after);

    /** 폼별 하루 발송 상한(IP·번호를 모두 바꿔 가는 공격에 대한 마지막 비용 천장). */
    long countByFormIdAndSmsSentTrueAndCreatedAtAfter(Long formId, Instant after);

    /** 접수 시 토큰 조회. */
    Optional<PhoneVerification> findByTokenHash(String tokenHash);
}
