package com.leadpot.quote;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface QuoteRepository extends JpaRepository<Quote, Long> {

    Optional<Quote> findByIdAndOwnerId(Long id, Long ownerId);

    List<Quote> findByOwnerIdOrderByIssueDateDescIdDesc(Long ownerId);

    List<Quote> findByOwnerIdAndAdvertiserProfileIdOrderByIssueDateDescIdDesc(Long ownerId, Long advertiserProfileId);

    boolean existsByOwnerIdAndQuoteNo(Long ownerId, String quoteNo);

    /** 이번 달 번호 접두어(예: {@code Q-2610-})로 시작하는 견적서 번호들 — 다음 일련번호를 정할 때 쓴다. */
    @Query("select q.quoteNo from Quote q where q.ownerId = :ownerId and q.quoteNo like concat(:prefix, '%')")
    List<String> findQuoteNosByPrefix(@Param("ownerId") Long ownerId, @Param("prefix") String prefix);

    /** 광고주 정보별 견적 건수·최근 견적일 — [광고주 정보 id, 건수, 최근 issueDate]. */
    @Query("select q.advertiserProfileId, count(q), max(q.issueDate) from Quote q "
            + "where q.ownerId = :ownerId and q.advertiserProfileId is not null group by q.advertiserProfileId")
    List<Object[]> summarizeByAdvertiserProfile(@Param("ownerId") Long ownerId);
}
