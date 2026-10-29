package com.leadpot.account;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.account.dto.BusinessProfileDto;

import jakarta.validation.Valid;

/** 마이페이지('내 정보') API — 로그인한 마케터 본인 것만. */
@RestController
@RequestMapping("/api/account")
public class AccountController {

    private final BusinessProfileService businessProfileService;

    public AccountController(BusinessProfileService businessProfileService) {
        this.businessProfileService = businessProfileService;
    }

    @GetMapping("/business-profile")
    public BusinessProfileDto getBusinessProfile(@AuthenticationPrincipal Jwt jwt) {
        return businessProfileService.get(userId(jwt));
    }

    @PutMapping("/business-profile")
    public BusinessProfileDto saveBusinessProfile(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody BusinessProfileDto request) {
        return businessProfileService.save(userId(jwt), request);
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
