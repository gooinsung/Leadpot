package com.leadpot.advertiser;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.advertiser.dto.InviteAcceptRequest;
import com.leadpot.advertiser.dto.InviteInfoResponse;
import com.leadpot.auth.dto.TokenResponse;

import jakarta.validation.Valid;

/**
 * 초대 링크 확인 / 수락 (비로그인 공개 경로).
 * <p>
 * 토큰은 256비트 난수라 추측이 불가능하고, DB에는 해시만 있다.
 * 응답에는 초대받은 이메일과 초대한 마케터 이름/회사만 담는다(그 외 정보 노출 금지).
 */
@RestController
@RequestMapping("/api/public/advertiser-invites")
public class PublicAdvertiserInviteController {

    private final AdvertiserInviteService inviteService;

    public PublicAdvertiserInviteController(AdvertiserInviteService inviteService) {
        this.inviteService = inviteService;
    }

    /** 링크 유효성 확인 + 화면에 보여줄 정보. */
    @GetMapping("/{token}")
    public InviteInfoResponse info(@PathVariable String token) {
        return inviteService.info(token);
    }

    /** 비밀번호를 정해 계정 생성 → 자동 로그인 토큰 반환. */
    @PostMapping("/{token}")
    public ResponseEntity<TokenResponse> accept(@PathVariable String token,
            @Valid @RequestBody InviteAcceptRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(inviteService.accept(token, request));
    }
}
