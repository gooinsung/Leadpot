package com.leadpot.phoneverify;

import java.util.Map;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.common.ClientIp;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

/** 공개 리드폼 휴대폰 본인인증(비로그인, V48). 경로는 docs/SPEC.md 에 잡아둔 자리 그대로. */
@RestController
@RequestMapping("/api/public/verify/phone")
public class PublicPhoneVerificationController {

    private final PhoneVerificationService service;

    public PublicPhoneVerificationController(PhoneVerificationService service) {
        this.service = service;
    }

    public record SendBody(@NotNull Long formId, String phone) {
    }

    public record ConfirmBody(@NotNull Long formId, String phone, String code) {
    }

    /** 인증번호 발송. 못 보내면 mode=FALLBACK 과 함께 미인증 접수용 token 을 준다. */
    @PostMapping("/send")
    public PhoneVerificationService.SendResult send(@Valid @RequestBody SendBody body, HttpServletRequest http) {
        return service.send(body.formId(), body.phone(), ClientIp.of(http));
    }

    /** 인증번호 확인 → 접수 때 함께 보낼 통과 토큰. */
    @PostMapping("/confirm")
    public Map<String, String> confirm(@Valid @RequestBody ConfirmBody body) {
        return Map.of("token", service.confirm(body.formId(), body.phone(), body.code()));
    }
}
