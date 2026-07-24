package com.leadpot.lead;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.lead.dto.LeadResponse;

/** 리드 조회·관리 API (로그인 필요, 본인 리드폼의 리드만 K5). */
@RestController
@RequestMapping("/api/leads")
public class LeadController {

    private final LeadService leadService;

    public LeadController(LeadService leadService) {
        this.leadService = leadService;
    }

    @GetMapping
    public List<LeadResponse> list(@AuthenticationPrincipal Jwt jwt, @RequestParam Long formId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            @RequestParam(required = false, defaultValue = "false") boolean trashed) {
        return leadService.list(userId(jwt), formId, status, q, trashed);
    }

    @GetMapping("/count")
    public Map<String, Long> count(@AuthenticationPrincipal Jwt jwt) {
        return Map.of("total", leadService.countByOwner(userId(jwt)));
    }

    /** 리드 상태 변경 (신규/상담중/완료/불량). */
    @PatchMapping("/{id}/status")
    public ResponseEntity<Void> updateStatus(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        leadService.updateStatus(userId(jwt), id, body.get("status"));
        return ResponseEntity.noContent().build();
    }

    /** 휴지통으로 이동(soft delete). */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> softDelete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        leadService.softDelete(userId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    /** 휴지통에서 복원. */
    @PostMapping("/{id}/restore")
    public ResponseEntity<Void> restore(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        leadService.restore(userId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    /** 영구 삭제(되돌릴 수 없음). */
    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<Void> permanentDelete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        leadService.permanentDelete(userId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    /** 리드폼의 리드 CSV 내보내기 (엑셀 호환 UTF-8 BOM). */
    @GetMapping("/export")
    public ResponseEntity<byte[]> export(@AuthenticationPrincipal Jwt jwt, @RequestParam Long formId) {
        String csv = leadService.exportCsv(userId(jwt), formId);
        byte[] bom = new byte[] { (byte) 0xEF, (byte) 0xBB, (byte) 0xBF };
        byte[] body = csv.getBytes(StandardCharsets.UTF_8);
        byte[] out = new byte[bom.length + body.length];
        System.arraycopy(bom, 0, out, 0, bom.length);
        System.arraycopy(body, 0, out, bom.length, body.length);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"leads_" + formId + ".csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(out);
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
