package com.leadpot.admin;

import java.util.List;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.admin.dto.AdminAuditRow;
import com.leadpot.admin.dto.AdminUserRow;
import com.leadpot.admin.dto.SmsPermissionRequest;
import com.leadpot.form.dto.FormSummary;
import com.leadpot.landing.dto.LandingSummary;
import com.leadpot.lead.dto.LeadResponse;

/**
 * 운영자 전용 API.
 *
 * <p><b>인가는 {@code SecurityConfig} 가 경로 단위로 한다</b> — {@code /api/admin/**} 는
 * {@code ROLE_ADMIN} 만 통과한다. 화이트리스트 방식이라 이 컨트롤러에 메서드를 추가해도
 * 자동으로 보호된다(반대로 컨트롤러마다 검사를 넣는 방식은 빠뜨리면 구멍이 된다).
 *
 * <p>범위: 계정 조회 + 문자 발송 권한 + <b>계정 자산(리드폼/랜딩/리드) 읽기 전용 열람</b>
 * (2026-08-19 정책 변경 — 조건과 이유는 {@link AdminService} 클래스 주석 참고).
 * 열람은 GET 뿐이다 — 운영자가 남의 자산을 고치는 엔드포인트는 만들지 않는다.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    /** 계정 목록. q 로 이메일·이름 부분검색. */
    @GetMapping("/users")
    public List<AdminUserRow> users(@RequestParam(required = false) String q) {
        return adminService.users(q);
    }

    /** 문자 발송 권한 변경(부분 수정). 넘기지 않은 필드는 그대로 둔다. */
    @PatchMapping("/users/{id}/sms")
    public AdminUserRow updateSms(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestBody SmsPermissionRequest request) {
        return adminService.updateSmsPermissions(adminId(jwt), id, request);
    }

    /** 계정의 리드폼 목록(읽기 전용). */
    @GetMapping("/users/{id}/forms")
    public List<FormSummary> forms(@PathVariable Long id) {
        return adminService.forms(id);
    }

    /** 계정의 랜딩 목록(읽기 전용). */
    @GetMapping("/users/{id}/landings")
    public List<LandingSummary> landings(@PathVariable Long id) {
        return adminService.landings(id);
    }

    /** 계정의 리드 목록(읽기 전용, 최신순 최대 200건). 호출마다 감사 로그가 남는다. */
    @GetMapping("/users/{id}/leads")
    public List<LeadResponse> leads(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestParam(required = false) Long formId) {
        return adminService.leads(adminId(jwt), id, formId);
    }

    /** 변경 이력(최신순). targetId 를 주면 그 계정 것만. */
    @GetMapping("/audit")
    public List<AdminAuditRow> audit(@RequestParam(required = false) Long targetId) {
        return adminService.audit(targetId);
    }

    private static Long adminId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
