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

/**
 * 운영자 전용 API.
 *
 * <p><b>인가는 {@code SecurityConfig} 가 경로 단위로 한다</b> — {@code /api/admin/**} 는
 * {@code ROLE_ADMIN} 만 통과한다. 화이트리스트 방식이라 이 컨트롤러에 메서드를 추가해도
 * 자동으로 보호된다(반대로 컨트롤러마다 검사를 넣는 방식은 빠뜨리면 구멍이 된다).
 *
 * <p>지금 범위는 계정 조회 + 문자 발송 권한뿐이다. 리드(고객 개인정보) 열람은 <b>일부러 넣지 않았다</b>
 * ({@link AdminService} 주석 참고).
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

    /** 변경 이력(최신순). targetId 를 주면 그 계정 것만. */
    @GetMapping("/audit")
    public List<AdminAuditRow> audit(@RequestParam(required = false) Long targetId) {
        return adminService.audit(targetId);
    }

    private static Long adminId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
