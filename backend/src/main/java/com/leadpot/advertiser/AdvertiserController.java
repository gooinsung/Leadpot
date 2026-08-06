package com.leadpot.advertiser;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
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

import com.leadpot.advertiser.dto.AdvertiserLeadPage;
import com.leadpot.advertiser.dto.AdvertiserLogResponse;
import com.leadpot.advertiser.dto.AdvertiserNotifyStatus;
import com.leadpot.advertiser.dto.AdvertiserPreviewLead;
import com.leadpot.advertiser.dto.AdvertiserPreviewResponse;
import com.leadpot.advertiser.dto.AdvertiserReportResponse;
import com.leadpot.advertiser.dto.AdvertiserSummary;
import com.leadpot.advertiser.dto.BrandSettings;
import com.leadpot.common.ClientIp;

import jakarta.servlet.http.HttpServletRequest;
import com.leadpot.advertiser.dto.AdvertiserUpdateRequest;
import com.leadpot.advertiser.dto.GrantUpdateRequest;
import com.leadpot.advertiser.dto.GrantView;
import com.leadpot.advertiser.dto.InviteRequest;
import com.leadpot.advertiser.dto.InviteResponse;
import com.leadpot.advertiser.dto.PasswordResetResponse;

import jakarta.validation.Valid;

/**
 * 마케터가 자기 광고주 하위계정을 관리하는 API.
 * <p>
 * 이 경로는 SecurityConfig 에서 <b>ROLE_USER(마케터)만</b> 허용된다.
 * 광고주 계정은 여기 접근할 수 없다(자기 위의 마케터나 다른 광고주를 볼 수 없음).
 */
@RestController
@RequestMapping("/api/advertisers")
public class AdvertiserController {

    private final AdvertiserService advertiserService;
    private final AdvertiserInviteService inviteService;
    private final AdvertiserPasswordResetService passwordResetService;

    public AdvertiserController(AdvertiserService advertiserService, AdvertiserInviteService inviteService,
            AdvertiserPasswordResetService passwordResetService) {
        this.advertiserService = advertiserService;
        this.inviteService = inviteService;
        this.passwordResetService = passwordResetService;
    }

    // ---------- 광고주 계정 ----------

    @GetMapping
    public List<AdvertiserSummary> list(@AuthenticationPrincipal Jwt jwt) {
        return advertiserService.list(userId(jwt));
    }

    @PutMapping("/{id}")
    public AdvertiserSummary update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @Valid @RequestBody AdvertiserUpdateRequest request) {
        return advertiserService.update(userId(jwt), id, request);
    }

    /** 정지/해제. body: {"active": true|false} */
    @PatchMapping("/{id}/active")
    public ResponseEntity<Void> setActive(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestBody Map<String, Boolean> body) {
        advertiserService.setActive(userId(jwt), id, Boolean.TRUE.equals(body.get("active")));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        advertiserService.delete(userId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    /** 광고주 활동 이력(최신순). 열람·상태변경·메모·내보내기·로그인 — 개인정보 취급 추적. */
    @GetMapping("/{id}/logs")
    public List<AdvertiserLogResponse> logs(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestParam(required = false) Integer limit) {
        return advertiserService.logs(userId(jwt), id, limit);
    }

    /** 광고주 처리속도 리포트(A7): 배정 폼 전체 합산. 접수→열람/상태 평균·미확인율·상태 분포. */
    @GetMapping("/{id}/reports/response-time")
    public AdvertiserReportResponse responseTimeReport(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestParam(required = false) String from, @RequestParam(required = false) String to) {
        return advertiserService.responseTimeReport(userId(jwt), id, from, to);
    }

    // ---------- 광고주 화면 미리보기(A7, impersonate·읽기 전용) ----------
    // 쓰기 매핑을 만들지 않는다(구조적 읽기 전용). 진입/이탈은 IMPERSONATE 로그로 남는다.

    /** 미리보기 진입: 폼 목록·대시보드(광고주 시점). IMPERSONATE 로그 기록. */
    @GetMapping("/{id}/preview")
    public AdvertiserPreviewResponse previewEnter(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            HttpServletRequest http) {
        return advertiserService.previewEnter(userId(jwt), id, ClientIp.of(http));
    }

    /** 미리보기 리드 목록(읽기 전용). */
    @GetMapping("/{id}/preview/leads")
    public AdvertiserLeadPage previewLeads(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestParam Long formId, @RequestParam(required = false) String status,
            @RequestParam(required = false) String q, @RequestParam(required = false) String from,
            @RequestParam(required = false) String to, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return advertiserService.previewLeads(userId(jwt), id, formId, status, q, from, to, page, size);
    }

    /** 미리보기 리드 상세(읽기 전용, seen 미기록) + 공유 메모. */
    @GetMapping("/{id}/preview/leads/{leadId}")
    public AdvertiserPreviewLead previewLead(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @PathVariable Long leadId) {
        return advertiserService.previewLead(userId(jwt), id, leadId);
    }

    /** 미리보기 이탈 기록(best-effort). */
    @PostMapping("/{id}/preview/exit")
    public ResponseEntity<Void> previewExit(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            HttpServletRequest http) {
        advertiserService.previewExit(userId(jwt), id, ClientIp.of(http));
        return ResponseEntity.noContent().build();
    }

    // ---------- 화이트라벨(내 브랜드) ----------

    /** 내 브랜드(로고·색상) 조회. 광고주 화면 상단에 표시된다. */
    @GetMapping("/brand")
    public BrandSettings getBrand(@AuthenticationPrincipal Jwt jwt) {
        return advertiserService.getBrand(userId(jwt));
    }

    /** 내 브랜드 저장. 색상은 #RRGGBB 형식, 빈 값이면 해제. */
    @PutMapping("/brand")
    public BrandSettings updateBrand(@AuthenticationPrincipal Jwt jwt, @RequestBody BrandSettings request) {
        return advertiserService.updateBrand(userId(jwt), request);
    }

    /**
     * 비밀번호 재설정 링크 발급. 광고주가 비밀번호를 잊었을 때 사용한다.
     * 응답의 token 은 이때만 볼 수 있고, 광고주가 새 비밀번호를 직접 정한다
     * (마케터는 광고주 비밀번호를 알 수 없다 — 감사 로그의 증거 가치 유지).
     */
    @PostMapping("/{id}/password-reset")
    public PasswordResetResponse issuePasswordReset(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return passwordResetService.issue(userId(jwt), id);
    }

    // ---------- 리드폼 권한 ----------

    /** 권한 부여 화면 데이터: 내 리드폼 전체 + 부여 상태 + 다른 광고주 선점 여부. */
    @GetMapping("/{id}/grants")
    public List<GrantView> grants(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return advertiserService.grantViews(userId(jwt), id);
    }

    /** 권한 일괄 교체(목록에 없는 리드폼은 회수). 다른 광고주가 쓰는 폼이면 409. */
    @PutMapping("/{id}/grants")
    public List<GrantView> replaceGrants(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @Valid @RequestBody GrantUpdateRequest request) {
        return advertiserService.replaceGrants(userId(jwt), id, request);
    }

    /**
     * 리드폼 하나의 광고주 접수 알림 수신 상태(V28). 리드폼 편집 화면에서 안내를 띄우는 데 쓴다.
     * <p>
     * 광고주 번호는 광고주가 포털에서 직접 등록한다 — 여기서는 등록 여부와 마스킹 값만 내려준다.
     */
    @GetMapping("/notify-status/{formId}")
    public AdvertiserNotifyStatus notifyStatus(@AuthenticationPrincipal Jwt jwt, @PathVariable Long formId) {
        return advertiserService.notifyStatus(userId(jwt), formId);
    }

    // ---------- 초대 ----------

    /** 초대 발급. 응답의 token 은 이때만 볼 수 있다(DB에는 해시만 저장). */
    @PostMapping("/invites")
    public ResponseEntity<InviteResponse> issueInvite(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody InviteRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(inviteService.issue(userId(jwt), request));
    }

    @GetMapping("/invites")
    public List<InviteResponse> invites(@AuthenticationPrincipal Jwt jwt) {
        return inviteService.list(userId(jwt));
    }

    /** 링크 재발급(이전 링크는 즉시 무효). 링크를 잃어버렸을 때 사용. */
    @PostMapping("/invites/{inviteId}/reissue")
    public InviteResponse reissueInvite(@AuthenticationPrincipal Jwt jwt, @PathVariable Long inviteId) {
        return inviteService.reissue(userId(jwt), inviteId);
    }

    @DeleteMapping("/invites/{inviteId}")
    public ResponseEntity<Void> cancelInvite(@AuthenticationPrincipal Jwt jwt, @PathVariable Long inviteId) {
        inviteService.cancel(userId(jwt), inviteId);
        return ResponseEntity.noContent().build();
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
