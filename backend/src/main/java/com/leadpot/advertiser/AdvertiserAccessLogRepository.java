package com.leadpot.advertiser;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AdvertiserAccessLogRepository extends JpaRepository<AdvertiserAccessLog, Long> {

    List<AdvertiserAccessLog> findByAdvertiserIdOrderByCreatedAtDesc(Long advertiserId, Pageable pageable);

    /** 오늘(또는 임의 시점 이후) 특정 액션 횟수 — 내보내기 일일 상한 판정용. */
    long countByAdvertiserIdAndActionAndCreatedAtAfter(Long advertiserId, String action, Instant since);

    /**
     * 이 리드에 남은 광고주 활동 전부(오래된 순) — 마케터 리드 상세의 '광고주' 타임라인(V33).
     * <p>
     * 광고주 id 로 좁히지 않는다. 리드폼의 광고주가 중간에 교체돼도 <b>그 리드를 누가 언제 봤는지</b>가
     * 남아 있어야 분쟁 때 답할 수 있기 때문이다. (내보내기 EXPORT 는 폼·필터 단위라 lead_id 가 없어 여기 안 잡힌다.)
     */
    List<AdvertiserAccessLog> findByLeadIdOrderByCreatedAtAsc(Long leadId);

    /** 최근 {@code since} 이후 같은 리드를 이 광고주가 열람한 기록이 있는지 — 새로고침 중복 기록 방지용. */
    boolean existsByAdvertiserIdAndLeadIdAndActionAndCreatedAtAfter(
            Long advertiserId, Long leadId, String action, Instant since);

    /** 광고주별 마지막 로그인 시각(목록 표시용). */
    @Query("select max(l.createdAt) from AdvertiserAccessLog l"
            + " where l.advertiserId = :advertiserId and l.action = 'LOGIN'")
    Instant findLastLoginAt(@Param("advertiserId") Long advertiserId);
}
