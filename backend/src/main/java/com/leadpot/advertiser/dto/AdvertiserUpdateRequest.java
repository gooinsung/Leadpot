package com.leadpot.advertiser.dto;

import jakarta.validation.constraints.Size;

/** 광고주 정보 수정(마케터가 관리하는 값만. 이메일·비밀번호는 여기서 바꾸지 않는다). */
public record AdvertiserUpdateRequest(
        @Size(max = 120, message = "이름은 120자 이하여야 합니다.") String name,
        @Size(max = 120, message = "회사명은 120자 이하여야 합니다.") String company,
        @Size(max = 500, message = "메모는 500자 이하여야 합니다.") String memo) {
}
