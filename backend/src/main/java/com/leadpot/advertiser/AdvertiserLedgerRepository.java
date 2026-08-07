package com.leadpot.advertiser;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AdvertiserLedgerRepository extends JpaRepository<AdvertiserLedgerEntry, Long> {

    /** 잔액 — 원장 합계가 곧 잔액이다(부호 규약: AdvertiserLedgerEntry). */
    @Query("select coalesce(sum(e.amount), 0) from AdvertiserLedgerEntry e where e.formId = :formId")
    long balance(@Param("formId") Long formId);

    /**
     * 기간 수익(원) — 차감(−)·환급(+)만 합산해 부호를 뒤집는다.
     * 차감 10,000 에 환급 3,000 이면 수익 7,000. 충전(CHARGE)은 예치금이지 수익이 아니라 뺀다.
     */
    @Query("select coalesce(-sum(e.amount), 0) from AdvertiserLedgerEntry e "
            + "where e.formId = :formId and e.entryType in ('DEBIT', 'REFUND') "
            + "and e.createdAt >= :from and e.createdAt < :to")
    long earnedBetween(@Param("formId") Long formId, @Param("from") Instant from, @Param("to") Instant to);

    /** 이 리드의 정산 잔여(차감−환급 합). 0 이면 차감분이 없거나 전부 환급됐다 — 중복 차감/환급 방지 판정. */
    @Query("select coalesce(sum(e.amount), 0) from AdvertiserLedgerEntry e "
            + "where e.leadId = :leadId and e.entryType in ('DEBIT', 'REFUND')")
    long netChargedForLead(@Param("leadId") Long leadId);

    List<AdvertiserLedgerEntry> findTop50ByFormIdOrderByCreatedAtDescIdDesc(Long formId);
}
