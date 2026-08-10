package com.leadpot.sms;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.leadpot.auth.User;

/**
 * 계정별 문자 발송 권한 판정(V25) — 순수 단위 테스트.
 *
 * <p><b>왜 이 테스트가 중요한가</b>: 문자는 리드팟 계정 하나로 나가고 <b>비용을 우리가 부담</b>한다.
 * 판정이 한 군데라도 열리면 그대로 돈이 샌다. 특히 <b>월 상한 0 의 의미</b>가
 * 제거된 플랜 상수와 <b>정반대</b>(그쪽은 0=무제한)라, 이 규약이 흔들리면
 * 권한 없는 계정이 무제한이 된다.
 */
class SmsPermissionsTest {

    private static User user(boolean enabled, String channels, int limit) {
        User u = new User("perm@test.local", "hash", "테스트", null);
        u.setSmsEnabled(enabled);
        u.setSmsAllowedChannels(channels);
        u.setSmsMonthlyLimit(limit);
        return u;
    }

    @Nested
    @DisplayName("기본은 전부 막혀 있다")
    class DefaultsClosed {

        @Test
        void 새_계정은_발송_권한이_없다() {
            User fresh = new User("fresh@test.local", "hash", "신규", null);
            assertThat(SmsPermissions.enabled(fresh)).isFalse();
            assertThat(SmsPermissions.allowedChannels(fresh)).isEmpty();
            assertThat(fresh.getSmsMonthlyLimit()).isZero();
            assertThat(SmsPermissions.denyReason(fresh, "SMS", 0)).isNotNull();
        }

        @Test
        void 계정을_못_찾으면_막는다() {
            // null 을 '열림'으로 보면 계정 조회 실패가 곧 무제한 발송이 된다.
            assertThat(SmsPermissions.enabled(null)).isFalse();
            assertThat(SmsPermissions.channelAllowed(null, "SMS")).isFalse();
            assertThat(SmsPermissions.remaining(null, 0)).isZero();
            assertThat(SmsPermissions.denyReason(null, "SMS", 0)).isNotNull();
        }
    }

    @Nested
    @DisplayName("월 상한 — 0 은 금지다 (예전 플랜 규약과 반대)")
    class MonthlyLimit {

        @Test
        void 상한_0_은_무제한이_아니라_금지다() {
            User u = user(true, "SMS", 0);
            assertThat(SmsPermissions.denyReason(u, "SMS", 0))
                    .as("0 을 무제한으로 해석하면 권한 없는 계정이 무제한이 된다")
                    .isNotNull();
            assertThat(SmsPermissions.remaining(u, 0)).isZero();
        }

        @Test
        void 음수는_무제한이다() {
            User u = user(true, "SMS", SmsPermissions.UNLIMITED);
            assertThat(SmsPermissions.unlimited(u)).isTrue();
            assertThat(SmsPermissions.denyReason(u, "SMS", 999_999)).isNull();
        }

        @Test
        void 양수는_그_건수까지만() {
            User u = user(true, "SMS", 3);
            assertThat(SmsPermissions.denyReason(u, "SMS", 2)).isNull();
            assertThat(SmsPermissions.denyReason(u, "SMS", 3)).isNotNull(); // 상한 도달
            assertThat(SmsPermissions.remaining(u, 2)).isEqualTo(1);
            assertThat(SmsPermissions.remaining(u, 5)).isZero(); // 음수로 내려가지 않는다
        }
    }

    @Nested
    @DisplayName("채널 권한")
    class Channels {

        @Test
        void 허용되지_않은_채널은_막는다() {
            User smsOnly = user(true, "SMS", 100);
            assertThat(SmsPermissions.channelAllowed(smsOnly, "SMS")).isTrue();
            assertThat(SmsPermissions.channelAllowed(smsOnly, "LMS")).isFalse();
            assertThat(SmsPermissions.channelAllowed(smsOnly, "MMS")).isFalse();
            assertThat(SmsPermissions.denyReason(smsOnly, "LMS", 0)).contains("LMS");
        }

        @Test
        void 발송이_꺼져_있으면_채널과_무관하게_막는다() {
            User off = user(false, "SMS,LMS,MMS", 100);
            assertThat(SmsPermissions.channelAllowed(off, "SMS")).isFalse();
        }

        @Test
        void 공백_소문자_알수없는값을_정리한다() {
            User messy = user(true, " sms , lms ,EMAIL,,", 10);
            assertThat(SmsPermissions.allowedChannels(messy)).containsExactly("SMS", "LMS");
        }

        @Test
        void 정규화는_유효한_채널만_정해진_순서로_남긴다() {
            assertThat(SmsPermissions.normalizeChannels("mms,sms")).isEqualTo("SMS,MMS");
            assertThat(SmsPermissions.normalizeChannels("EMAIL")).isEmpty();
            assertThat(SmsPermissions.normalizeChannels(null)).isEmpty();
            assertThat(SmsPermissions.normalizeChannels("SMS,SMS")).isEqualTo("SMS");
        }

        @Test
        void 채널_상수는_발송기_판정값과_같아야_한다() {
            // channelOf 가 돌려주는 값과 CSV 토큰이 어긋나면 권한 검사가 조용히 전부 실패한다.
            assertThat(SolapiSmsSender.channelOf("짧은 본문")).isIn(SmsPermissions.CHANNELS.toArray());
            assertThat(SolapiSmsSender.channelOf("가".repeat(200))).isIn(SmsPermissions.CHANNELS.toArray());
            assertThat(SolapiSmsSender.channelOf("본문", "file-id")).isEqualTo("MMS");
            // ATA(알림톡)만 본문 길이가 아니라 수신자 유형으로 정해지므로 channelOf 가 돌려주지 않는다.
            assertThat(SmsPermissions.CHANNELS).isEqualTo(List.of("SMS", "LMS", "MMS", SmsPermissions.ATA));
        }

        @Test
        void 알림톡_채널도_허용목록으로_통제된다() {
            // 기존 계정은 CSV 에 ATA 가 없다 — 관리자가 켜기 전까지 막혀야 한다(조용히 열리면 안 된다).
            User onlySms = user(true, "SMS,LMS,MMS", -1);
            assertThat(SmsPermissions.channelAllowed(onlySms, SmsPermissions.ATA)).isFalse();
            assertThat(SmsPermissions.denyReason(onlySms, SmsPermissions.ATA, 0)).contains("ATA");

            User withAta = user(true, "SMS,ATA", -1);
            assertThat(SmsPermissions.channelAllowed(withAta, SmsPermissions.ATA)).isTrue();
            assertThat(SmsPermissions.normalizeChannels("ata,sms")).isEqualTo("SMS,ATA");
        }
    }
}
