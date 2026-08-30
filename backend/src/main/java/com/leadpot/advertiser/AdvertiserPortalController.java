package com.leadpot.advertiser;

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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.advertiser.dto.AdvertiserFormResponse;
import com.leadpot.advertiser.dto.AdvertiserLeadPage;
import com.leadpot.advertiser.dto.AdvertiserLeadResponse;
import com.leadpot.advertiser.dto.AdvertiserMeResponse;
import com.leadpot.advertiser.dto.AdvertiserNoteResponse;
import com.leadpot.advertiser.dto.AdvertiserReportResponse;
import com.leadpot.advertiser.dto.NotifyDisabledRequest;
import com.leadpot.advertiser.dto.NotifyPhoneRequest;
import com.leadpot.common.ClientIp;
import com.leadpot.integration.IntegrationService;
import com.leadpot.lead.LeadStatusOptionsService;
import com.leadpot.integration.dto.IntegrationRequest;
import com.leadpot.integration.dto.IntegrationResponse;
import com.leadpot.integration.dto.TestResult;
import com.leadpot.lead.LeadExcelService;

import jakarta.servlet.http.HttpServletRequest;

/**
 * 광고주 포털 API. SecurityConfig 에서 <b>ROLE_ADVERTISER 만</b> 접근 가능하다.
 *
 * <h3>⛔ 여기에 만들지 않는 것 (사용자 확정 — 엄격하게)</h3>
 * 리드 <b>삭제·휴지통·복원·영구삭제</b>, 리드 <b>가져오기</b>(엑셀 업로드), 태그 편집,
 * 리드폼·랜딩 조회, 다른 광고주 정보.
 * <p>
 * 권한 플래그로 막는 게 아니라 <b>엔드포인트 자체를 만들지 않는다.</b>
 * 코드가 없으면 실수로 열릴 수도 없다. 이 원칙을 지켜서 DELETE 매핑을 추가하지 말 것.
 * (엑셀 내보내기는 A4 에서 추가한다 — 감사 로그·다운로드 추적과 함께.)
 */
@RestController
@RequestMapping("/api/advertiser")
public class AdvertiserPortalController {

    private final AdvertiserLeadService leadService;
    private final IntegrationService integrationService;
    private final LeadExcelService excelService;
    private final LeadStatusOptionsService statusOptionsService;

    public AdvertiserPortalController(AdvertiserLeadService leadService, IntegrationService integrationService,
            LeadExcelService excelService, LeadStatusOptionsService statusOptionsService) {
        this.excelService = excelService;
        this.leadService = leadService;
        this.integrationService = integrationService;
        this.statusOptionsService = statusOptionsService;
    }

    /** 내 정보 + 소속 마케터 브랜드(화이트라벨). */
    @GetMapping("/me")
    public AdvertiserMeResponse me(@AuthenticationPrincipal Jwt jwt) {
        return leadService.me(userId(jwt));
    }

    /** 권한 받은 리드폼 목록(표시 이름·건수·미확인 수). */
    @GetMapping("/forms")
    public List<AdvertiserFormResponse> forms(@AuthenticationPrincipal Jwt jwt) {
        return leadService.forms(userId(jwt));
    }

    /**
     * 접수 알림을 받을 <b>내 기본 번호</b>를 등록·변경한다 — 배정된 <b>모든</b> 리드폼에 적용된다(V33).
     * 빈 값이면 지워진다.
     *
     * <p>마케터는 이 번호를 대신 넣을 수 없다 — 광고주 본인이 넣는 행위가 수신 동의 근거다
     * (docs/MESSAGING-PLAN.md §9).
     */
    @PutMapping("/notify-phone")
    public Map<String, String> updateDefaultNotifyPhone(@AuthenticationPrincipal Jwt jwt,
            @RequestBody NotifyPhoneRequest request) {
        return Map.of("notifyPhone", leadService.updateDefaultNotifyPhone(userId(jwt), request.phone()));
    }

    /**
     * <b>이 리드폼에만</b> 적용할 번호를 등록·변경한다. 빈 값이면 덮어쓰기가 해제되고
     * 계정 기본 번호를 따라간다(V33) — 발송이 멈추는 게 아니다. 멈추려면 {@code notify-disabled} 를 쓴다.
     */
    @PutMapping("/forms/{formId}/notify-phone")
    public AdvertiserFormResponse updateNotifyPhone(@AuthenticationPrincipal Jwt jwt,
            @PathVariable Long formId, @RequestBody NotifyPhoneRequest request) {
        return leadService.updateNotifyPhone(userId(jwt), formId, request.phone());
    }

    /** 이 리드폼만 접수 알림을 끄거나 다시 켠다(계정 기본 번호가 있어도 끈 폼은 안 보낸다). */
    @PutMapping("/forms/{formId}/notify-disabled")
    public AdvertiserFormResponse updateNotifyDisabled(@AuthenticationPrincipal Jwt jwt,
            @PathVariable Long formId, @RequestBody NotifyDisabledRequest request) {
        return leadService.updateNotifyDisabled(userId(jwt), formId, request.disabled());
    }

    /** 대시보드 요약(미확인 건수·오늘 접수·상태 분포). */
    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(@AuthenticationPrincipal Jwt jwt) {
        return leadService.dashboard(userId(jwt));
    }

    /** 리드 목록. size 는 서버에서 상한(100)이 강제된다. unseenOnly=true 면 광고주 미확인 리드만. */
    @GetMapping("/leads")
    public AdvertiserLeadPage leads(@AuthenticationPrincipal Jwt jwt,
            @RequestParam Long formId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) Boolean unseenOnly,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return leadService.leads(userId(jwt), formId, status, q, from, to, unseenOnly, page, size);
    }

    /** 리드 상세(최초 열람 시각 기록). */
    @GetMapping("/leads/{id}")
    public AdvertiserLeadResponse lead(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            HttpServletRequest http) {
        return leadService.lead(userId(jwt), id, ClientIp.of(http));
    }

    /**
     * 상태 변경 — 통합 축(V29). body: {"status":"VALID"} 또는 {"status":"CUSTOM","customStatusId":3}.
     * 무효(INVALID)·AS요청(AS_REQUESTED)은 여기로 넣을 수 없다(무효=마케터 전용, AS=전용 플로우).
     */
    @PatchMapping("/leads/{id}/status")
    public AdvertiserLeadResponse updateStatus(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestBody Map<String, Object> body, HttpServletRequest http) {
        return leadService.updateStatus(userId(jwt), id,
                body.get("status") == null ? null : body.get("status").toString(),
                asLong(body.get("customStatusId")), ClientIp.of(http));
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

    /**
     * AS 요청 접수(V30). body: {"reason":"...", "evidenceUrls":["..."]}.
     * 사유는 필수, 증빙은 /api/advertiser/uploads 로 올린 이미지 URL(최대 5장).
     */
    @PostMapping("/leads/{id}/as-request")
    public com.leadpot.lead.dto.LeadAsRequestResponse requestAs(@AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest http) {
        return leadService.requestAs(userId(jwt), id,
                body.get("reason") == null ? null : body.get("reason").toString(),
                stringList(body.get("evidenceUrls")), ClientIp.of(http));
    }

    /** 이 리드의 AS 이력(최신순). */
    @GetMapping("/leads/{id}/as-requests")
    public List<com.leadpot.lead.dto.LeadAsRequestResponse> asHistory(@AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id) {
        return leadService.asHistory(userId(jwt), id);
    }

    @SuppressWarnings("unchecked")
    private static List<String> stringList(Object v) {
        if (!(v instanceof List<?> list)) {
            return List.of();
        }
        return list.stream().filter(java.util.Objects::nonNull).map(Object::toString).toList();
    }

    /** 공유 메모/이력 조회(마케터 내부 메모는 포함되지 않는다). */
    @GetMapping("/leads/{id}/notes")
    public List<AdvertiserNoteResponse> notes(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return leadService.notes(userId(jwt), id);
    }

    /** 메모 작성. body: {"body": "..."} */
    @PostMapping("/leads/{id}/notes")
    public AdvertiserNoteResponse addNote(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestBody Map<String, String> body, HttpServletRequest http) {
        return leadService.addNote(userId(jwt), id, body.get("body"), ClientIp.of(http));
    }

    /** 상태 선택지(고정 4 + 내 커스텀). 무효는 표시용 — 화면에서 선택 불가로 그린다. */
    @GetMapping("/lead-statuses")
    public List<LeadStatusOptionsService.StatusOption> statuses(@AuthenticationPrincipal Jwt jwt) {
        return statusOptionsService.optionsForAdvertiser(userId(jwt));
    }

    // ---------- 커스텀 상태 관리(V29) — 광고주 본인만 ----------
    // (클래스 상단의 "DELETE 매핑 금지" 원칙은 **리드 데이터** 이야기다. 아래 DELETE 는
    //  광고주가 자기 상태 정의를 지우는 것이라 해당하지 않는다 — 리드는 건드리지 못한다.)

    /** 내 커스텀 상태 전부(보관 포함, 관리 화면용). */
    @GetMapping("/statuses")
    public List<LeadStatusOptionsService.StatusOption> manageStatuses(@AuthenticationPrincipal Jwt jwt) {
        return statusOptionsService.manageList(userId(jwt));
    }

    /** 커스텀 상태 생성. body: {"name":"상담중"} */
    @PostMapping("/statuses")
    public LeadStatusOptionsService.StatusOption createStatus(@AuthenticationPrincipal Jwt jwt,
            @RequestBody Map<String, String> body) {
        return statusOptionsService.create(userId(jwt), body.get("name"));
    }

    /** 이름 변경·보관 토글. body: {"name":"부재중"} 또는 {"archived":true} */
    @PatchMapping("/statuses/{id}")
    public LeadStatusOptionsService.StatusOption updateStatusDef(@AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id, @RequestBody Map<String, Object> body) {
        return statusOptionsService.update(userId(jwt), id,
                body.get("name") == null ? null : body.get("name").toString(),
                body.get("archived") == null ? null : Boolean.valueOf(body.get("archived").toString()));
    }

    /** 삭제 — 쓰는 리드가 없을 때만. 있으면 400 과 함께 보관을 안내한다. */
    @DeleteMapping("/statuses/{id}")
    public ResponseEntity<Void> deleteStatusDef(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        statusOptionsService.delete(userId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    /**
     * 실시간 폴링(A6): since 이후 새 리드 수. 프론트가 30초마다 호출해 자동 갱신·알림에 쓴다.
     * 응답의 serverTime 을 다음 요청 since 로 넘긴다(시계 오차 방지).
     */
    @GetMapping("/leads/updates")
    public Map<String, Object> updates(@AuthenticationPrincipal Jwt jwt, @RequestParam Long formId,
            @RequestParam(required = false) String since) {
        return leadService.updates(userId(jwt), formId, since);
    }

    /** 처리속도 리포트(A7): 접수→최초열람·상태변경 평균, 미확인율, 상태 분포. 기간 필터. */
    @GetMapping("/reports")
    public AdvertiserReportResponse report(@AuthenticationPrincipal Jwt jwt, @RequestParam Long formId,
            @RequestParam(required = false) String from, @RequestParam(required = false) String to) {
        return leadService.report(userId(jwt), formId, from, to);
    }

    /**
     * 배정받은 리드 내보내기(A4). 화면 필터(status·q·from·to)를 그대로 반영한다.
     * 화이트리스트 컬럼(접수일시·상태·답변)만, 파일 하단 워터마크, EXPORT 감사 로그, 일일 횟수 상한.
     * format=xlsx|csv(기본 xlsx).
     */
    @PostMapping("/leads/export")
    public ResponseEntity<byte[]> export(@AuthenticationPrincipal Jwt jwt, @RequestParam Long formId,
            @RequestParam(required = false) String format,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            HttpServletRequest http) {
        List<List<String>> matrix = leadService.export(userId(jwt), formId, status, q, from, to, ClientIp.of(http));
        boolean csv = "csv".equalsIgnoreCase(format);
        String base = "leads_" + formId;
        if (csv) {
            byte[] out = withBom(toCsv(matrix));
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + base + ".csv\"")
                    .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                    .body(out);
        }
        byte[] body = excelService.dataXlsx("리드", matrix);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + base + ".xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(body);
    }

    private static byte[] withBom(String csv) {
        byte[] bom = { (byte) 0xEF, (byte) 0xBB, (byte) 0xBF };
        byte[] body = csv.getBytes(StandardCharsets.UTF_8);
        byte[] out = new byte[bom.length + body.length];
        System.arraycopy(bom, 0, out, 0, bom.length);
        System.arraycopy(body, 0, out, bom.length, body.length);
        return out;
    }

    private static String toCsv(List<List<String>> matrix) {
        StringBuilder sb = new StringBuilder();
        for (List<String> row : matrix) {
            for (int i = 0; i < row.size(); i++) {
                if (i > 0) {
                    sb.append(',');
                }
                sb.append(csvCell(row.get(i)));
            }
            sb.append("\r\n");
        }
        return sb.toString();
    }

    /** CSV 셀 이스케이프(콤마·따옴표·개행이 있으면 큰따옴표로 감싸고 내부 따옴표는 2배). */
    private static String csvCell(String v) {
        String s = v == null ? "" : v;
        if (s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    // ---------- 알림 연동(A5) ----------
    // integration_settings 는 계정(user id)당 1행이라 광고주도 자기 행을 그대로 쓴다(스키마 변경 없음).
    // 각자 자기 행만 조회/수정하므로 교차 접근 위험이 없다. 텔레그램 계정 채널만 다룬다(구글시트는 마케터 폼 설정).

    /** 내 텔레그램 알림 설정 조회. */
    @GetMapping("/integrations")
    public IntegrationResponse getIntegration(@AuthenticationPrincipal Jwt jwt) {
        return integrationService.get(userId(jwt));
    }

    /** 내 텔레그램 알림 설정 저장. */
    @PutMapping("/integrations")
    public IntegrationResponse updateIntegration(@AuthenticationPrincipal Jwt jwt,
            @RequestBody IntegrationRequest request) {
        return integrationService.update(userId(jwt), request);
    }

    /** 내 텔레그램 채널로 테스트 메시지 발송. */
    @PostMapping("/integrations/test")
    public TestResult testIntegration(@AuthenticationPrincipal Jwt jwt) {
        return integrationService.test(userId(jwt));
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
