package com.leadpot.ipblock.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** IP 차단 규칙 추가 요청. pattern 은 단일 IP 또는 CIDR. */
public record IpBlockRequest(
        @NotBlank(message = "차단할 IP 또는 대역을 입력해주세요.")
        @Size(max = 64, message = "IP/대역은 64자 이내로 입력해주세요.")
        String pattern,
        @Size(max = 255, message = "사유는 255자 이내로 입력해주세요.")
        String reason) {
}
