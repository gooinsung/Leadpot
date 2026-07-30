package com.leadpot.advertiser.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 광고주 초대 발급 요청. */
public record InviteRequest(
        @NotBlank(message = "이메일을 입력해주세요.")
        @Email(message = "이메일 형식이 올바르지 않습니다.")
        @Size(max = 255) String email,

        @Size(max = 120, message = "이름은 120자 이하여야 합니다.") String name,
        @Size(max = 120, message = "회사명은 120자 이하여야 합니다.") String company) {
}
