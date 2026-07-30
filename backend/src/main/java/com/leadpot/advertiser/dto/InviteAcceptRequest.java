package com.leadpot.advertiser.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 초대 수락 — 광고주가 직접 비밀번호를 정한다(마케터는 비밀번호를 알 수 없다). */
public record InviteAcceptRequest(
        @NotBlank(message = "비밀번호를 입력해주세요.")
        @Size(min = 8, max = 100, message = "비밀번호는 8자 이상이어야 합니다.") String password,

        @Size(max = 120, message = "이름은 120자 이하여야 합니다.") String name,
        @Size(max = 30, message = "연락처는 30자 이하여야 합니다.") String phone) {
}
