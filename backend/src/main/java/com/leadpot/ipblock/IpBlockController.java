package com.leadpot.ipblock;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.ipblock.dto.IpBlockHitResponse;
import com.leadpot.ipblock.dto.IpBlockRequest;
import com.leadpot.ipblock.dto.IpBlockResponse;

import jakarta.validation.Valid;

/** 리드폼별 IP 차단 관리 API (로그인 필요, 본인 리드폼만 K5). */
@RestController
@RequestMapping("/api/forms/{formId}/ip-blocks")
public class IpBlockController {

    private final IpBlockService ipBlockService;

    public IpBlockController(IpBlockService ipBlockService) {
        this.ipBlockService = ipBlockService;
    }

    /** 차단 규칙 목록. */
    @GetMapping
    public List<IpBlockResponse> list(@AuthenticationPrincipal Jwt jwt, @PathVariable Long formId) {
        return ipBlockService.list(userId(jwt), formId);
    }

    /** 차단 규칙 추가(단일 IP 또는 CIDR). */
    @PostMapping
    public ResponseEntity<IpBlockResponse> add(@AuthenticationPrincipal Jwt jwt, @PathVariable Long formId,
            @Valid @RequestBody IpBlockRequest request) {
        IpBlockResponse res = ipBlockService.add(userId(jwt), formId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }

    /** 차단 규칙 삭제. */
    @DeleteMapping("/{blockId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long formId,
            @PathVariable Long blockId) {
        ipBlockService.delete(userId(jwt), formId, blockId);
        return ResponseEntity.noContent().build();
    }

    /** 차단 접속(제출 시도) 로그. */
    @GetMapping("/hits")
    public List<IpBlockHitResponse> hits(@AuthenticationPrincipal Jwt jwt, @PathVariable Long formId) {
        return ipBlockService.hits(userId(jwt), formId);
    }

    /** 차단 접속 로그 전체 비우기. */
    @DeleteMapping("/hits")
    public ResponseEntity<Void> clearHits(@AuthenticationPrincipal Jwt jwt, @PathVariable Long formId) {
        ipBlockService.clearHits(userId(jwt), formId);
        return ResponseEntity.noContent().build();
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
