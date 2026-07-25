package com.leadpot.ipblock;

import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.form.FormService;
import com.leadpot.ipblock.dto.IpBlockHitResponse;
import com.leadpot.ipblock.dto.IpBlockRequest;
import com.leadpot.ipblock.dto.IpBlockResponse;

/** 리드폼별 IP 차단(K2) — 규칙 CRUD(본인 리드폼만 K5) + 차단 시도 로그 조회/기록. */
@Service
public class IpBlockService {

    /** 로그 조회 최대 건수(과도한 조회 방지). */
    private static final int MAX_HITS = 500;

    private final IpBlockRepository blockRepository;
    private final IpBlockHitRepository hitRepository;
    private final FormService formService;

    public IpBlockService(IpBlockRepository blockRepository, IpBlockHitRepository hitRepository,
            FormService formService) {
        this.blockRepository = blockRepository;
        this.hitRepository = hitRepository;
        this.formService = formService;
    }

    // ---------- 관리(로그인, 본인 리드폼만 K5) ----------

    @Transactional(readOnly = true)
    public List<IpBlockResponse> list(Long ownerId, Long formId) {
        formService.get(ownerId, formId); // 소유권 확인(아니면 404)
        return blockRepository.findByFormIdOrderByCreatedAtDesc(formId)
                .stream().map(IpBlockResponse::from).toList();
    }

    @Transactional
    public IpBlockResponse add(Long ownerId, Long formId, IpBlockRequest req) {
        formService.get(ownerId, formId); // 소유권 확인
        String pattern = req.pattern() == null ? "" : req.pattern().trim();
        if (!IpMatcher.isValid(pattern)) {
            throw new InvalidSubmissionException("올바른 IP 또는 대역(CIDR)이 아닙니다. 예: 1.2.3.4 또는 1.2.3.0/24");
        }
        String reason = req.reason() == null || req.reason().isBlank() ? null : req.reason().trim();
        IpBlock saved = blockRepository.save(new IpBlock(formId, pattern, reason));
        return IpBlockResponse.from(saved);
    }

    @Transactional
    public void delete(Long ownerId, Long formId, Long blockId) {
        formService.get(ownerId, formId); // 소유권 확인
        IpBlock block = blockRepository.findById(blockId)
                .orElseThrow(() -> new NotFoundException("차단 규칙을 찾을 수 없습니다."));
        if (!block.getFormId().equals(formId)) {
            throw new NotFoundException("차단 규칙을 찾을 수 없습니다.");
        }
        blockRepository.delete(block);
    }

    @Transactional(readOnly = true)
    public List<IpBlockHitResponse> hits(Long ownerId, Long formId) {
        formService.get(ownerId, formId); // 소유권 확인
        return hitRepository.findByFormIdOrderByCreatedAtDesc(formId, PageRequest.of(0, MAX_HITS))
                .stream().map(IpBlockHitResponse::from).toList();
    }

    /** 차단 시도 로그 전체 비우기(본인 리드폼만). */
    @Transactional
    public void clearHits(Long ownerId, Long formId) {
        formService.get(ownerId, formId); // 소유권 확인
        hitRepository.deleteByFormId(formId);
    }

    // ---------- 공개 제출 경로(비로그인)에서 사용 ----------

    /** ip 가 이 리드폼의 차단 규칙에 걸리면 매칭된 pattern, 아니면 null. */
    @Transactional(readOnly = true)
    public String blockedPattern(Long formId, String ip) {
        if (ip == null || ip.isBlank()) {
            return null;
        }
        for (IpBlock b : blockRepository.findByFormIdOrderByCreatedAtDesc(formId)) {
            if (IpMatcher.matches(b.getPattern(), ip)) {
                return b.getPattern();
            }
        }
        return null;
    }

    /**
     * 차단 시도를 로그로 남긴다. 제출 트랜잭션이 롤백(거부)되어도 로그는 남도록
     * 별도 트랜잭션(REQUIRES_NEW)으로 커밋한다.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordHit(Long formId, String ip, String matchedPattern, String userAgent, String referer) {
        hitRepository.save(new IpBlockHit(formId, cut(ip, 64), cut(matchedPattern, 64),
                cut(userAgent, 1024), cut(referer, 1024)));
    }

    private static String cut(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() > max ? s.substring(0, max) : s;
    }
}
