package com.leadpot.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/** 비밀번호 재설정 인증번호 발송 요청. */
public record PasswordResetRequestBody(@NotBlank @Email String email) {
}
