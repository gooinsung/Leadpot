package com.leadpot.common.error;

/**
 * 공개 회원가입이 닫혀 있음. 운영자가 계정을 직접 관리하는 동안 무단 가입을 막는다.
 *
 * <p>설정: {@code app.auth.signup-enabled}(기본 false). 화면도 함께 닫혀 있지만
 * <b>화면만 막으면 API 직접 호출로 가입할 수 있어</b> 서버에서도 판정한다.
 *
 * <p>⚠️ 광고주 하위계정 <b>초대 수락</b>({@code /api/public/advertiser-invites/{token}})은
 * 이 설정과 무관하게 계속 동작한다 — 마케터가 발급한 초대 링크로만 만들어지므로 무단 가입이 아니다.
 */
public class SignupClosedException extends RuntimeException {

    public SignupClosedException(String message) {
        super(message);
    }
}
