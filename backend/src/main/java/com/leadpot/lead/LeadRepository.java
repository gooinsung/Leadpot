package com.leadpot.lead;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LeadRepository extends JpaRepository<Lead, Long> {

    // 활성 리드(휴지통 제외) — 목록·CSV
    List<Lead> findByFormIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long formId);

    // 휴지통 리드
    List<Lead> findByFormIdAndDeletedAtIsNotNullOrderByCreatedAtDesc(Long formId);

    long countByFormId(Long formId);

    // 동적 요소(M8): 랜딩 연결폼들의 활성 리드 수 / 최근 리드 (실시간 신청수·최근 신청자·남은 자리)
    long countByFormIdInAndDeletedAtIsNull(java.util.Collection<Long> formIds);

    List<Lead> findTop10ByFormIdInAndDeletedAtIsNullOrderByCreatedAtDesc(java.util.Collection<Long> formIds);

    // 통합 인박스(U1): 내 모든 폼의 활성 리드 합산(최신순).
    List<Lead> findByFormIdInAndDeletedAtIsNullOrderByCreatedAtDesc(java.util.Collection<Long> formIds);

    // 중복 방지: 기간 내 활성 리드(항목 값 대조용). 휴지통 리드는 중복으로 보지 않음.
    List<Lead> findByFormIdAndCreatedAtGreaterThanEqualAndDeletedAtIsNull(Long formId, java.time.Instant after);

    // 실시간 폴링(A6): 특정 시각 이후 접수된 활성 리드 수(광고주 새 리드 감지용).
    long countByFormIdAndDeletedAtIsNullAndCreatedAtAfter(Long formId, java.time.Instant after);

    // 커스텀 상태 삭제 가능 판정(V29) — 휴지통 리드도 복원될 수 있으므로 함께 센다.
    boolean existsByCustomStatusId(Long customStatusId);

    /**
     * 리드폼 삭제 시 소속 리드 일괄 삭제(휴지통 포함). 벌크 DELETE 한 방 — 자식(lead_notes·
     * lead_as_requests)은 DB cascade 가 정리한다. leads.form_id FK 에 on delete 가 없어(V5)
     * 이걸 먼저 지우지 않으면 리드폼 삭제가 DB 에서 거부된다(2026-08-09 사용자 제보 버그).
     */
    @org.springframework.data.jpa.repository.Modifying
    @Query("delete from Lead l where l.formId = :formId")
    void deleteAllByFormId(@Param("formId") Long formId);

    // 과금 화면(V31): 유효 리드 수(누적 확정 물량 표시용).
    long countByFormIdAndDeletedAtIsNullAndStatus(Long formId, String status);

    // 과금 화면(V31): 승인 대기(유효도 무효도 아닌) 리드 수.
    long countByFormIdAndDeletedAtIsNullAndStatusNotIn(Long formId, java.util.Collection<String> statuses);

    // 정산 총괄: 폼별 오늘 접수 수 일괄 집계. [formId, count]
    @Query("select l.formId, count(l) from Lead l where l.formId in :formIds "
            + "and l.deletedAt is null and l.createdAt >= :since group by l.formId")
    List<Object[]> countSinceGrouped(@Param("formIds") java.util.List<Long> formIds,
            @Param("since") java.time.Instant since);

    // 정산 총괄: 폼별 특정 상태 리드 수 일괄 집계. [formId, count]
    @Query("select l.formId, count(l) from Lead l where l.formId in :formIds "
            + "and l.deletedAt is null and l.status = :status group by l.formId")
    List<Object[]> countStatusGrouped(@Param("formIds") java.util.List<Long> formIds,
            @Param("status") String status);

    // 정산 총괄: 폼별 승인 대기(유효·무효 제외) 리드 수 일괄 집계. [formId, count]
    @Query("select l.formId, count(l) from Lead l where l.formId in :formIds "
            + "and l.deletedAt is null and l.status not in :excluded group by l.formId")
    List<Object[]> countStatusNotInGrouped(@Param("formIds") java.util.List<Long> formIds,
            @Param("excluded") java.util.Collection<String> excluded);

    // 중복 방지: 기간 내 동일 IP 활성 제출 존재 여부
    boolean existsByFormIdAndSubmitterIpAndCreatedAtGreaterThanEqualAndDeletedAtIsNull(Long formId, String ip, java.time.Instant after);

    // 본인 소유 리드폼들의 전체 활성 리드 수 (대시보드용, K5)
    @Query("select count(l) from Lead l where l.formId in (select f.id from Form f where f.ownerId = :ownerId) "
            + "and l.deletedAt is null")
    long countByOwner(@Param("ownerId") Long ownerId);

    // 대시보드 '신규 리드'(오늘 접수) — 특정 시각 이후 접수된 본인 소유 활성 리드 수
    @Query("select count(l) from Lead l where l.formId in (select f.id from Form f where f.ownerId = :ownerId) "
            + "and l.deletedAt is null and l.createdAt >= :since")
    long countByOwnerSince(@Param("ownerId") Long ownerId, @Param("since") java.time.Instant since);

    // 본인 소유 리드폼들의 전체 활성 리드 (통계 집계용)
    @Query("select l from Lead l where l.formId in (select f.id from Form f where f.ownerId = :ownerId) "
            + "and l.deletedAt is null")
    List<Lead> findAllByOwner(@Param("ownerId") Long ownerId);

    // 본인 소유 활성 리드 + 기간(반열림 [from, to)) — 통계 필터용
    @Query("select l from Lead l where l.formId in (select f.id from Form f where f.ownerId = :ownerId) "
            + "and l.deletedAt is null and l.createdAt >= :from and l.createdAt < :to")
    List<Lead> findByOwnerBetween(@Param("ownerId") Long ownerId,
            @Param("from") java.time.Instant from, @Param("to") java.time.Instant to);

    /**
     * 자동 승인 대상 — 한 리드폼에서 <b>기준 시각 이후에 접수됐고</b> 유예 기간이 지난 활성 리드.
     *
     * <p>{@code since} 조건이 있어야 소급 적용을 막을 수 있다(설정을 켠 시점 이후 접수분만).
     * 이유는 {@link AutoApproveSettings} 주석 참고. 경계는 양쪽 모두 포함이다.
     */
    @Query("select l from Lead l where l.formId = :formId and l.deletedAt is null "
            + "and l.status in :statuses and l.createdAt >= :since and l.createdAt <= :cutoff")
    List<Lead> findAutoApproveTargets(@Param("formId") Long formId,
            @Param("statuses") java.util.Collection<String> statuses,
            @Param("since") java.time.Instant since,
            @Param("cutoff") java.time.Instant cutoff);

    /**
     * 계정별 활성 리드 수 — 어드민 계정 목록용. 한 방에 집계한다.
     * <p>계정마다 {@link #countByOwner} 를 부르면 계정 수만큼 왕복이 생기는데,
     * DB 가 원격(현재 Neon 싱가포르, 쿼리당 170~280ms)이라 20개 계정이면 수 초가 된다.
     */
    @Query("select f.ownerId, count(l) from Lead l join Form f on l.formId = f.id "
            + "where l.deletedAt is null group by f.ownerId")
    List<Object[]> countActiveGroupedByOwner();
}
