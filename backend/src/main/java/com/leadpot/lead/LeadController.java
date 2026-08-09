package com.leadpot.lead;

import java.io.IOException;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.leadpot.lead.dto.BulkLeadRequest;
import com.leadpot.lead.dto.ImportResult;
import com.leadpot.lead.dto.InboxResponse;
import com.leadpot.lead.dto.LeadExportRequest;
import com.leadpot.lead.dto.LeadNoteResponse;
import com.leadpot.lead.dto.LeadResponse;

/** 리드 조회·관리 API (로그인 필요, 본인 리드폼의 리드만 K5). */
@RestController
@RequestMapping("/api/leads")
public class LeadController {

    private final LeadService leadService;
    private final LeadExcelService excelService;
    private final LeadStatusOptionsService statusOptionsService;
    private final com.leadpot.form.FormService formService;

    public LeadController(LeadService leadService, LeadExcelService excelService,
            LeadStatusOptionsService statusOptionsService, com.leadpot.form.FormService formService) {
        this.leadService = leadService;
        this.excelService = excelService;
        this.statusOptionsService = statusOptionsService;
        this.formService = formService;
    }

    @GetMapping
    public List<LeadResponse> list(@AuthenticationPrincipal Jwt jwt, @RequestParam Long formId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            @RequestParam(required = false, defaultValue = "false") boolean trashed) {
        return leadService.list(userId(jwt), formId, status, q, trashed);
    }

    /** 대시보드 카운트. todayNew = 오늘(KST) 접수된 리드 수('신규 리드' 카드). */
    @GetMapping("/count")
    public Map<String, Long> count(@AuthenticationPrincipal Jwt jwt) {
        return Map.of("total", leadService.countByOwner(userId(jwt)),
                "todayNew", leadService.countTodayByOwner(userId(jwt)));
    }

    /**
     * 통합 인박스(U1): 내 모든 리드폼의 리드를 한 스트림으로. 필터·페이징 + 사이드 rail 카운트.
     * unseen=true 면 미확인(신규 NEW)만.
     */
    @GetMapping("/inbox")
    public InboxResponse inbox(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long formId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false, defaultValue = "false") boolean unseen,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return leadService.inbox(userId(jwt), status, q, formId, from, to, unseen, page, size);
    }

    /** 리드 단건 상세(본인 리드폼만). */
    @GetMapping("/{id}")
    public LeadResponse getOne(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return leadService.getOne(userId(jwt), id);
    }

    /** 리드 메모/이력 목록. */
    @GetMapping("/{id}/notes")
    public List<LeadNoteResponse> notes(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return leadService.listNotes(userId(jwt), id);
    }

    /**
     * 사용자 메모 추가. body: {"body":"...", "shared":true|false}.
     * shared=true → 광고주메모(광고주와 공유), false(기본) → 마케터메모(마케터만).
     */
    @PostMapping("/{id}/notes")
    public LeadNoteResponse addNote(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        boolean shared = Boolean.TRUE.equals(body.get("shared"))
                || "true".equalsIgnoreCase(String.valueOf(body.get("shared")));
        return leadService.addNote(userId(jwt), id,
                body.get("body") == null ? null : body.get("body").toString(), shared);
    }

    /** 메모 삭제(사용자 메모만). */
    @DeleteMapping("/{id}/notes/{noteId}")
    public ResponseEntity<Void> deleteNote(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @PathVariable Long noteId) {
        leadService.deleteNote(userId(jwt), id, noteId);
        return ResponseEntity.noContent().build();
    }

    /** 리드 태그 교체. body: {"tags": ["VIP", ...]} */
    @PutMapping("/{id}/tags")
    public LeadResponse updateTags(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestBody Map<String, List<String>> body) {
        return leadService.updateTags(userId(jwt), id, body.get("tags"));
    }

    /**
     * 리드 상태 변경 — 통합 축 V29 (신규/유효/무효/커스텀 · AS요청은 AS 플로우 전용).
     * body: {"status":"VALID"} 또는 {"status":"CUSTOM","customStatusId":3}
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<Void> updateStatus(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        leadService.updateStatus(userId(jwt), id,
                body.get("status") == null ? null : body.get("status").toString(),
                asLong(body.get("customStatusId")));
        return ResponseEntity.noContent().build();
    }

    /** 이 리드의 AS 이력(최신순) — 사유·증빙·처리 결과. */
    @GetMapping("/{id}/as-requests")
    public java.util.List<com.leadpot.lead.dto.LeadAsRequestResponse> asHistory(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return leadService.asHistory(userId(jwt), id);
    }

    /**
     * AS 해소(마케터). body: {"accept":true|false, "note":"..."}.
     * 인정 → 리드 무효(차감분 환급) / 거부 → 리드 유효 확정.
     */
    @PostMapping("/{id}/as-resolve")
    public com.leadpot.lead.dto.LeadAsRequestResponse resolveAs(@AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id, @RequestBody Map<String, Object> body) {
        boolean accept = Boolean.TRUE.equals(body.get("accept"))
                || "true".equalsIgnoreCase(String.valueOf(body.get("accept")));
        return leadService.resolveAs(userId(jwt), id, accept,
                body.get("note") == null ? null : body.get("note").toString());
    }

    /** 상태 선택지(고정 4 + 이 폼 광고주의 커스텀). 사이드패널·필터가 쓴다. */
    @GetMapping("/status-options")
    public java.util.List<LeadStatusOptionsService.StatusOption> statusOptions(
            @AuthenticationPrincipal Jwt jwt, @RequestParam Long formId) {
        formService.get(userId(jwt), formId); // 소유권 확인(아니면 404)
        return statusOptionsService.optionsForForm(formId);
    }

    private static Long asLong(Object v) {
        if (v == null) {
            return null;
        }
        try {
            return Long.valueOf(v.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** 일괄 상태변경(U2). body: {"ids":[...], "status":"..."}. 처리 건수 반환. */
    @PatchMapping("/bulk/status")
    public Map<String, Integer> bulkStatus(@AuthenticationPrincipal Jwt jwt, @RequestBody BulkLeadRequest req) {
        return Map.of("updated",
                leadService.bulkUpdateStatus(userId(jwt), req.ids(), req.status(), req.customStatusId()));
    }

    /**
     * 마케터 열람 표시 일괄 변경(V32). body: {"ids":[...]}. 처리 건수 반환.
     *
     * <p>'미확인'은 리드 상태가 아니라 <b>내가 이 리드를 봤는지</b>다 — 상태는 광고주도 바꾸므로
     * 열람 여부의 근거가 될 수 없다. 상태는 전혀 건드리지 않는다.
     */
    @PostMapping("/bulk/seen")
    public Map<String, Integer> bulkSeen(@AuthenticationPrincipal Jwt jwt, @RequestBody BulkLeadRequest req) {
        return Map.of("updated", leadService.markSeen(userId(jwt), req.ids(), true));
    }

    /** 다시 '미확인'으로 되돌리기(나중에 처리하려고 남겨둘 때). body: {"ids":[...]}. */
    @PostMapping("/bulk/unseen")
    public Map<String, Integer> bulkUnseen(@AuthenticationPrincipal Jwt jwt, @RequestBody BulkLeadRequest req) {
        return Map.of("updated", leadService.markSeen(userId(jwt), req.ids(), false));
    }

    /** 일괄 휴지통 이동(U2). body: {"ids":[...]}. 처리 건수 반환. */
    @PostMapping("/bulk/trash")
    public Map<String, Integer> bulkTrash(@AuthenticationPrincipal Jwt jwt, @RequestBody BulkLeadRequest req) {
        return Map.of("trashed", leadService.bulkSoftDelete(userId(jwt), req.ids()));
    }

    /** 일괄 복원(휴지통 전체선택, 2026-08-08). body: {"ids":[...]}. */
    @PostMapping("/bulk/restore")
    public Map<String, Integer> bulkRestore(@AuthenticationPrincipal Jwt jwt, @RequestBody BulkLeadRequest req) {
        return Map.of("restored", leadService.bulkRestore(userId(jwt), req.ids()));
    }

    /** 일괄 영구 삭제(휴지통 전용, 되돌릴 수 없음). body: {"ids":[...]}. */
    @PostMapping("/bulk/permanent")
    public Map<String, Integer> bulkPermanent(@AuthenticationPrincipal Jwt jwt, @RequestBody BulkLeadRequest req) {
        return Map.of("deleted", leadService.bulkPermanentDelete(userId(jwt), req.ids()));
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

    /** 내보내기 가능한 컬럼 목록(선택 UI용). */
    @GetMapping("/columns")
    public List<String> exportColumns(@AuthenticationPrincipal Jwt jwt, @RequestParam Long formId) {
        return leadService.exportColumns(userId(jwt), formId);
    }

    /**
     * 리드 내보내기. 본문: format=csv(기본)|xlsx, columns=선택 컬럼(생략 시 전체), ids=선택 리드(생략 시 전체).
     * xlsx 는 모든 셀 텍스트 서식(날짜·번호 자동변환 방지), csv 는 엑셀 호환 UTF-8 BOM.
     * ids 로 현재 화면 필터가 적용된 리드만 내보낼 수 있다(POST 로 긴 목록 전송).
     */
    @PostMapping("/export")
    public ResponseEntity<byte[]> export(@AuthenticationPrincipal Jwt jwt, @RequestParam Long formId,
            @RequestBody(required = false) LeadExportRequest req) {
        Long uid = userId(jwt);
        String format = (req == null || req.format() == null) ? "csv" : req.format();
        List<String> columns = req == null ? null : req.columns();
        List<Long> ids = req == null ? null : req.ids();
        if ("xlsx".equalsIgnoreCase(format)) {
            byte[] body = excelService.dataXlsx("리드", leadService.exportMatrix(uid, formId, columns, ids));
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"leads_" + formId + ".xlsx\"")
                    .contentType(MediaType.parseMediaType(
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .body(body);
        }
        String csv = leadService.exportCsv(uid, formId, columns, ids);
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

    /** 리드폼 기본 양식 다운로드(format=xlsx|csv). 헤더=리드폼 항목 라벨. */
    @GetMapping("/template")
    public ResponseEntity<byte[]> template(@AuthenticationPrincipal Jwt jwt, @RequestParam Long formId,
            @RequestParam(required = false, defaultValue = "xlsx") String format) {
        List<String> cols = leadService.templateColumns(userId(jwt), formId);
        boolean csv = "csv".equalsIgnoreCase(format);
        byte[] body = csv ? excelService.templateCsv(cols) : excelService.templateXlsx(cols);
        String ext = csv ? "csv" : "xlsx";
        String contentType = csv
                ? "text/csv; charset=UTF-8"
                : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"lead_template_" + formId + "." + ext + "\"")
                .contentType(MediaType.parseMediaType(contentType))
                .body(body);
    }

    /** 엑셀/CSV 파일로 리드 일괄 등록. 결과 요약(등록/실패/사유) 반환. */
    @PostMapping("/import")
    public ImportResult importLeads(@AuthenticationPrincipal Jwt jwt, @RequestParam Long formId,
            @RequestParam("file") MultipartFile file) throws IOException {
        List<Map<String, String>> rows = excelService.parse(file.getOriginalFilename(), file.getBytes());
        return leadService.importRows(userId(jwt), formId, rows);
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
