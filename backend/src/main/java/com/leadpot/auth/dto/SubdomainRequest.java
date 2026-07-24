package com.leadpot.auth.dto;

import jakarta.validation.constraints.NotBlank;

/** 서브도메인 변경 요청. 형식/예약어/중복 검증은 서비스에서 수행. */
public record SubdomainRequest(
        @NotBlank(message = "서브도메인을 입력해주세요.") String subdomain) {
}
