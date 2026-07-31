package com.leadpot.advertiser;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
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
import com.leadpot.common.ClientIp;
import com.leadpot.integration.IntegrationService;
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

    public AdvertiserPortalController(AdvertiserLeadService leadService, IntegrationService integrationService,
            LeadExcelService excelService) {
        this.excelService = excelService;
        this.leadService = leadService;
        this.integrationService = integrationService;
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

    /** 대시보드 요약(미확인 건수·오늘 접수·상태 분포). */
    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(@AuthenticationPrincipal Jwt jwt) {
        return leadService.dashboard(userId(jwt));
    }

    /** 리드 목록. size 는 서버에서 상한(100)이 강제된다. */
    @GetMapping("/leads")
    public AdvertiserLeadPage leads(@AuthenticationPrincipal Jwt jwt,
            @RequestParam Long formId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return leadService.leads(userId(jwt), formId, status, q, from, to, page, size);
    }

    /** 리드 상세(최초 열람 시각 기록). */
    @GetMapping("/leads/{id}")
    public AdvertiserLeadResponse lead(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            HttpServletRequest http) {
        return leadService.lead(userId(jwt), id, ClientIp.of(http));
    }

    /** 상태 변경 (신규/확인/통화완료/부재/종료). body: {"status": "CALLED"} */
    @PatchMapping("/leads/{id}/status")
    public AdvertiserLeadResponse updateStatus(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestBody Map<String, String> body, HttpServletRequest http) {
        return leadService.updateStatus(userId(jwt), id, body.get("status"), ClientIp.of(http));
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

    /** 상태 값 목록(화면 셀렉트용). */
    @GetMapping("/lead-statuses")
    public Map<String, String> statuses() {
        return AdvertiserLeadStatus.LABELS;
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
