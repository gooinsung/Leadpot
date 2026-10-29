package com.leadpot.advertiser.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 광고주 정보 생성·수정. 회사명만 필수.
 * {@code advertiserUserId} — 연결할 광고주 포털 계정(내 광고주만). null 이면 연결 해제.
 */
public record AdvertiserProfileRequest(
        @NotBlank(message = "회사명을 입력해주세요.") @Size(max = 120, message = "회사명은 120자 이하여야 합니다.") String companyName,
        @Size(max = 60, message = "대표자는 60자 이하여야 합니다.") String ceoName,
        @Size(max = 20, message = "사업자번호는 20자 이하여야 합니다.") String bizNo,
        @Size(max = 60, message = "담당자는 60자 이하여야 합니다.") String contactName,
        @Size(max = 40, message = "연락처는 40자 이하여야 합니다.") String phone,
        @Size(max = 255, message = "이메일은 255자 이하여야 합니다.") String email,
        @Size(max = 255, message = "주소는 255자 이하여야 합니다.") String address,
        @Size(max = 500, message = "메모는 500자 이하여야 합니다.") String memo,
        Long advertiserUserId) {
}
