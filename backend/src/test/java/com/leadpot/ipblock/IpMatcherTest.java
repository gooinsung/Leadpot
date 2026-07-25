package com.leadpot.ipblock;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/** IpMatcher(단일 IP · CIDR 매칭) 순수 단위 테스트 — K2 차단 판정 로직 검증. */
class IpMatcherTest {

    @Nested
    @DisplayName("단일 IP 매칭")
    class SingleIp {

        @Test
        void 정확히_일치하면_true() {
            assertTrue(IpMatcher.matches("1.2.3.4", "1.2.3.4"));
        }

        @Test
        void 다르면_false() {
            assertFalse(IpMatcher.matches("1.2.3.4", "1.2.3.5"));
        }

        @Test
        void 앞뒤_공백은_무시() {
            assertTrue(IpMatcher.matches("  1.2.3.4 ", " 1.2.3.4"));
        }
    }

    @Nested
    @DisplayName("CIDR 대역 매칭")
    class Cidr {

        @Test
        void 대역_안이면_true() {
            assertTrue(IpMatcher.matches("10.0.0.0/24", "10.0.0.55"));
            assertTrue(IpMatcher.matches("10.0.0.0/24", "10.0.0.0"));
            assertTrue(IpMatcher.matches("10.0.0.0/24", "10.0.0.255"));
        }

        @Test
        void 대역_밖이면_false() {
            assertFalse(IpMatcher.matches("10.0.0.0/24", "10.0.1.55"));
            assertFalse(IpMatcher.matches("10.0.0.0/24", "10.1.0.55"));
        }

        @Test
        void 비트경계_prefix가_바이트에_안맞아도_정확() {
            // /28 → 마지막 바이트 상위 4비트만 비교 (16개: .16 ~ .31)
            assertTrue(IpMatcher.matches("192.168.1.16/28", "192.168.1.16"));
            assertTrue(IpMatcher.matches("192.168.1.16/28", "192.168.1.31"));
            assertFalse(IpMatcher.matches("192.168.1.16/28", "192.168.1.32"));
            assertFalse(IpMatcher.matches("192.168.1.16/28", "192.168.1.15"));
        }

        @Test
        void prefix_32는_단일_IP와_동일() {
            assertTrue(IpMatcher.matches("1.2.3.4/32", "1.2.3.4"));
            assertFalse(IpMatcher.matches("1.2.3.4/32", "1.2.3.5"));
        }

        @Test
        void prefix_0은_모든_IPv4를_포함() {
            assertTrue(IpMatcher.matches("0.0.0.0/0", "8.8.8.8"));
            assertTrue(IpMatcher.matches("0.0.0.0/0", "255.255.255.255"));
        }
    }

    @Nested
    @DisplayName("IPv6")
    class Ipv6 {

        @Test
        void 단일_IPv6_정규화_비교() {
            // 축약 표기와 완전 표기가 같은 주소로 인식되어야 한다
            assertTrue(IpMatcher.matches("2001:db8::1", "2001:0db8:0000:0000:0000:0000:0000:0001"));
        }

        @Test
        void IPv6_CIDR_대역() {
            assertTrue(IpMatcher.matches("2001:db8::/32", "2001:db8:abcd::1"));
            assertFalse(IpMatcher.matches("2001:db8::/32", "2001:db9::1"));
        }

        @Test
        void IPv4와_IPv6는_섞이지_않음() {
            assertFalse(IpMatcher.matches("0.0.0.0/0", "2001:db8::1"));
            assertFalse(IpMatcher.matches("::/0", "1.2.3.4"));
        }
    }

    @Nested
    @DisplayName("잘못된 입력 / 방어")
    class Invalid {

        @Test
        void null이나_빈값은_false() {
            assertFalse(IpMatcher.matches(null, "1.2.3.4"));
            assertFalse(IpMatcher.matches("1.2.3.4", null));
            assertFalse(IpMatcher.matches("", "1.2.3.4"));
            assertFalse(IpMatcher.matches("1.2.3.4", ""));
        }

        @Test
        void 잘못된_pattern은_예외없이_false() {
            assertFalse(IpMatcher.matches("not-an-ip", "1.2.3.4"));
            assertFalse(IpMatcher.matches("1.2.3.4/99", "1.2.3.4"));
            assertFalse(IpMatcher.matches("1.2.3.4/abc", "1.2.3.4"));
        }

        @Test
        void 호스트명은_DNS조회_없이_false() {
            // 대상 IP 자리에 호스트명이 오면 리터럴이 아니므로 매칭하지 않는다(DNS 조회 방지)
            assertFalse(IpMatcher.matches("1.2.3.4", "example.com"));
            assertFalse(IpMatcher.matches("example.com", "1.2.3.4"));
        }
    }

    @Nested
    @DisplayName("isValid(입력 저장 전 검증)")
    class IsValid {

        @Test
        void 유효한_단일IP와_CIDR() {
            assertTrue(IpMatcher.isValid("1.2.3.4"));
            assertTrue(IpMatcher.isValid("10.0.0.0/24"));
            assertTrue(IpMatcher.isValid("192.168.1.16/28"));
            assertTrue(IpMatcher.isValid("2001:db8::/32"));
            assertTrue(IpMatcher.isValid("2001:db8::1"));
        }

        @Test
        void 무효한_입력() {
            assertFalse(IpMatcher.isValid(null));
            assertFalse(IpMatcher.isValid(""));
            assertFalse(IpMatcher.isValid("   "));
            assertFalse(IpMatcher.isValid("not-an-ip"));
            assertFalse(IpMatcher.isValid("1.2.3.4/33"));   // IPv4 최대 32
            assertFalse(IpMatcher.isValid("2001:db8::/129")); // IPv6 최대 128
            assertFalse(IpMatcher.isValid("example.com"));    // 호스트명 불가
        }
    }
}
