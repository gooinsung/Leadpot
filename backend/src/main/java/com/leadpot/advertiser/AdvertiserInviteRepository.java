package com.leadpot.advertiser;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AdvertiserInviteRepository extends JpaRepository<AdvertiserInvite, Long> {

    /** 토큰 해시로 초대 조회(공개 수락 경로). */
    Optional<AdvertiserInvite> findByTokenHash(String tokenHash);

    Optional<AdvertiserInvite> findByIdAndMarketerId(Long id, Long marketerId);

    List<AdvertiserInvite> findByMarketerIdOrderByCreatedAtDesc(Long marketerId);

    /** 대기 중(미수락) 초대 — 플랜 상한 계산과 중복 초대 방지에 사용. */
    List<AdvertiserInvite> findByMarketerIdAndAcceptedAtIsNull(Long marketerId);

    Optional<AdvertiserInvite> findByMarketerIdAndEmailAndAcceptedAtIsNull(Long marketerId, String email);
}
