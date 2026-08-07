package com.leadpot.lead;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomLeadStatusRepository extends JpaRepository<CustomLeadStatus, Long> {

    /** 선택 목록용 — 보관(archived)은 제외. */
    List<CustomLeadStatus> findByAdvertiserIdAndArchivedFalseOrderBySortOrderAscIdAsc(Long advertiserId);

    /** 표시용 — 보관 포함 전부(기존 리드에 붙은 이름을 그려야 한다). */
    List<CustomLeadStatus> findByAdvertiserIdOrderBySortOrderAscIdAsc(Long advertiserId);

    /** 중복 이름 방지(보관 여부와 무관 — 같은 이름을 되살리려면 보관 해제를 쓰게 한다). */
    Optional<CustomLeadStatus> findByAdvertiserIdAndName(Long advertiserId, String name);

    long countByAdvertiserIdAndArchivedFalse(Long advertiserId);
}
