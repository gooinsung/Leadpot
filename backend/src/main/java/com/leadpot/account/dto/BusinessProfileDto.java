package com.leadpot.account.dto;

import com.leadpot.account.BusinessProfile;

import jakarta.validation.constraints.Size;

/** 사업장 정보 조회·저장(같은 모양). 모든 칸은 선택 — 비운 칸은 견적서에서 빠진다. */
public record BusinessProfileDto(
        @Size(max = 120, message = "상호는 120자 이하여야 합니다.") String companyName,
        @Size(max = 60, message = "대표자는 60자 이하여야 합니다.") String ceoName,
        @Size(max = 20, message = "사업자번호는 20자 이하여야 합니다.") String bizNo,
        @Size(max = 255, message = "주소는 255자 이하여야 합니다.") String address,
        @Size(max = 40, message = "연락처는 40자 이하여야 합니다.") String phone,
        @Size(max = 255, message = "이메일은 255자 이하여야 합니다.") String email,
        @Size(max = 255, message = "입금 계좌는 255자 이하여야 합니다.") String bankAccount) {

    public static final BusinessProfileDto EMPTY = new BusinessProfileDto("", "", "", "", "", "", "");

    public static BusinessProfileDto from(BusinessProfile p) {
        return new BusinessProfileDto(p.getCompanyName(), p.getCeoName(), p.getBizNo(), p.getAddress(),
                p.getPhone(), p.getEmail(), p.getBankAccount());
    }
}
