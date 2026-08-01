package com.leadpot.ipblock;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.ipblock.dto.IpBlockRequest;
import com.leadpot.ipblock.dto.IpBlockResponse;

/**
 * 계정 전역 접속 차단 — 등록한 IP/대역이 이 계정의 공개 화면(랜딩·리드폼)에
 * 아예 접속하지 못하게 한다.
 * <p>
 * {@link IpBlockService}(K2, 리드폼별 제출 차단)와 목적이 다르므로 따로 둔다.
 * 규칙 매칭은 {@link IpMatcher} 를 그대로 쓴다.
 */
@Service
public class SiteIpBlockService {

    private final SiteIpBlockRepository repository;

    public SiteIpBlockService(SiteIpBlockRepository repository) {
        this.repository = repository;
    }

    // ---------- 관리(로그인한 마케터 본인 것만) ----------

    @Transactional(readOnly = true)
    public List<IpBlockResponse> list(Long userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(b -> new IpBlockResponse(b.getId(), b.getPattern(), b.getReason(), b.getCreatedAt()))
                .toList();
    }

    @Transactional
    public IpBlockResponse add(Long userId, IpBlockRequest req) {
        String pattern = req.pattern() == null ? "" : req.pattern().trim();
        if (!IpMatcher.isValid(pattern)) {
            throw new InvalidSubmissionException("올바른 IP 또는 대역(CIDR)이 아닙니다. 예: 1.2.3.4 또는 1.2.3.0/24");
        }
        String reason = req.reason() == null || req.reason().isBlank() ? null : req.reason().trim();
        SiteIpBlock saved = repository.save(new SiteIpBlock(userId, pattern, reason));
        return new IpBlockResponse(saved.getId(), saved.getPattern(), saved.getReason(), saved.getCreatedAt());
    }

    @Transactional
    public void delete(Long userId, Long blockId) {
        SiteIpBlock block = repository.findById(blockId)
                .orElseThrow(() -> new NotFoundException("차단 규칙을 찾을 수 없습니다."));
        // 남의 규칙은 존재 자체를 알리지 않는다(K5).
        if (!block.getUserId().equals(userId)) {
            throw new NotFoundException("차단 규칙을 찾을 수 없습니다.");
        }
        repository.delete(block);
    }

    // ---------- 공개 화면에서의 판정 ----------

    /**
     * 이 계정의 공개 화면에 접속하려는 IP 가 차단 대상인지.
     * 규칙이 없거나 IP 를 알 수 없으면 막지 않는다(오탐으로 정상 방문자를 막지 않기 위해).
     */
    @Transactional(readOnly = true)
    public boolean isBlocked(Long userId, String ip) {
        if (userId == null || ip == null || ip.isBlank()) {
            return false;
        }
        List<SiteIpBlock> rules = repository.findByUserIdOrderByCreatedAtDesc(userId);
        for (SiteIpBlock r : rules) {
            if (IpMatcher.matches(r.getPattern(), ip)) {
                return true;
            }
        }
        return false;
    }
}
