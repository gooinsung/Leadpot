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

import com.leadpot.ipblock.dto.IpBlockRequest;
import com.leadpot.ipblock.dto.IpBlockResponse;

import jakarta.validation.Valid;

/**
 * 계정 전역 접속 차단 관리 API (로그인 필요, 본인 규칙만).
 * 리드폼별 제출 차단은 {@link IpBlockController}(/api/forms/{formId}/ip-blocks) 로 따로 있다.
 */
@RestController
@RequestMapping("/api/site-ip-blocks")
public class SiteIpBlockController {

    private final SiteIpBlockService service;

    public SiteIpBlockController(SiteIpBlockService service) {
        this.service = service;
    }

    @GetMapping
    public List<IpBlockResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return service.list(userId(jwt));
    }

    @PostMapping
    public ResponseEntity<IpBlockResponse> add(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody IpBlockRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.add(userId(jwt), request));
    }

    @DeleteMapping("/{blockId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long blockId) {
        service.delete(userId(jwt), blockId);
        return ResponseEntity.noContent().build();
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
