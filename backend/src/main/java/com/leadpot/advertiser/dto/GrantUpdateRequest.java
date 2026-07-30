package com.leadpot.advertiser.dto;

import java.time.Instant;
import java.util.List;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 권한 일괄 교체 요청. 목록에 <b>없는</b> 리드폼의 권한은 회수된다(전체 교체 방식).
 */
public record GrantUpdateRequest(List<Item> grants) {

    public record Item(
            @NotNull(message = "리드폼을 선택해주세요.") Long formId,
            @Size(max = 120, message = "표시 이름은 120자 이하여야 합니다.") String displayName,
            Instant expiresAt,
            Boolean canStatus,
            Boolean canMemo,
            Boolean canExport) {

        public boolean statusAllowed() {
            return canStatus == null || canStatus;
        }

        public boolean memoAllowed() {
            return canMemo == null || canMemo;
        }

        public boolean exportAllowed() {
            return canExport == null || canExport;
        }
    }

    public List<Item> items() {
        return grants == null ? List.of() : grants;
    }
}
