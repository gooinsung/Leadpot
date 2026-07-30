package com.leadpot.auth;

/**
 * 계정 권한.
 * <ul>
 * <li>{@code USER} — 마케터. 리드폼·랜딩·리드를 소유하고 광고주 하위계정을 관리한다.</li>
 * <li>{@code ADVERTISER} — 광고주 하위계정. 마케터가 권한을 부여한 리드폼의 리드만 열람·상태변경한다.
 * 소유 마케터는 {@code users.parent_user_id}. 접근 가능한 API 는 {@code /api/advertiser/**} 뿐이다.</li>
 * <li>{@code ADMIN} — 운영자(후기 확장용).</li>
 * </ul>
 * 권한은 액세스 토큰의 {@code role} 클레임으로 전달되고, SecurityConfig 의
 * JwtAuthenticationConverter 가 {@code ROLE_*} authority 로 변환해 경로 규칙에 사용한다.
 */
public enum Role {
    USER,
    ADVERTISER,
    ADMIN
}
