package com.leadpot.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 인증번호 확인 + 새 비밀번호 설정 요청. 비밀번호 규칙은 가입(SignupRequest)과 동일하게 유지한다. */
public record PasswordResetConfirmBody(
        @NotBlank @Email String email,
        @NotBlank @Size(min = 6, max = 6) String code,
        @NotBlank @Size(min = 8, max = 72) String password) {
}
