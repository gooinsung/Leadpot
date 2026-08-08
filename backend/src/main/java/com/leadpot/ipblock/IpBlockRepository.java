package com.leadpot.ipblock;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface IpBlockRepository extends JpaRepository<IpBlock, Long> {

    List<IpBlock> findByFormIdOrderByCreatedAtDesc(Long formId);

    /** 리드폼 삭제 시 차단 규칙 정리 — ip_blocks.form_id FK 에 on delete 가 없다(V13). */
    void deleteByFormId(Long formId);
}
