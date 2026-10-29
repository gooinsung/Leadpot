package com.leadpot.quote.dto;

import java.time.LocalDate;
import java.util.List;

import com.leadpot.quote.VatMode;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 견적서 작성·수정.
 * <ul>
 * <li>기존 광고주 선택: {@code advertiserProfileId} + 화면이 채운 {@code recipient}(이 견적서에서만 고칠 수 있다)</li>
 * <li>수동 입력: {@code advertiserProfileId=null} + {@code recipient}. {@code saveAsAdvertiser=true} 면 광고주 정보로도 저장</li>
 * </ul>
 * 공급자는 받지 않는다 — 서버가 마이페이지 사업장 정보에서 복사한다.
 */
public record QuoteRequest(
        Long advertiserProfileId,
        boolean saveAsAdvertiser,
        @NotNull(message = "받는 쪽 정보를 입력해주세요.") @Valid QuoteParty recipient,
        @NotBlank(message = "제목을 입력해주세요.") @Size(max = 200, message = "제목은 200자 이하여야 합니다.") String title,
        LocalDate issueDate,
        LocalDate validUntil,
        VatMode vatMode,
        @NotNull @Size(max = 100, message = "품목은 100줄까지 넣을 수 있습니다.") List<@Valid QuoteItem> items,
        @Size(max = 30, message = "안내 문구는 30줄까지 넣을 수 있습니다.") List<@Size(max = 500, message = "안내 문구는 한 줄에 500자까지입니다.") String> notes) {
}
