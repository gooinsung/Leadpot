package com.leadpot.advertiser.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 새 비밀번호 설정 요청. */
public record PasswordResetRequest(
        @NotBlank(message = "비밀번호를 입력해주세요.")
        @Size(min = 8, max = 100, message = "비밀번호는 8자 이상이어야 합니다.") String password) {
}
