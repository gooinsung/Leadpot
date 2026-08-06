package com.leadpot.lead;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface LeadNoteRepository extends JpaRepository<LeadNote, Long> {

    List<LeadNote> findByLeadIdOrderByCreatedAtAsc(Long leadId);

    /**
     * 작성자를 비운다 — 계정을 지우기 전에 부른다(광고주 하위계정 삭제).
     *
     * <p>메모 본문은 마케터의 리드 이력이라 <b>보존하고 작성자만 지운다</b>(사용자 결정 2026-08-06).
     * DB 의 FK 도 {@code on delete set null} 이라 안전망이 이중이지만(V27), 여기서 명시적으로
     * 처리하는 이유는 두 가지다 — ① 삭제 순서를 코드에서 읽을 수 있고, ② <b>테스트가 H2 라
     * FK 동작을 재현하지 못한다</b>(H2 스키마는 Hibernate 가 만들고, ownerId 는 연관관계가 아닌
     * 단순 컬럼이라 FK 자체가 생기지 않는다).
     *
     * @return 작성자를 비운 메모 수
     */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("update LeadNote n set n.ownerId = null where n.ownerId = :ownerId")
    int clearOwner(@org.springframework.data.repository.query.Param("ownerId") Long ownerId);
}
