package com.leadpot.adautomation.platform.karrot;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.leadpot.adautomation.connection.CredentialCipher;
import com.leadpot.adautomation.platform.AdPlatformClient.AdCampaign;
import com.leadpot.adautomation.platform.AdPlatformException;
import com.leadpot.common.error.InvalidSubmissionException;

import tools.jackson.databind.json.JsonMapper;

/** 당근 어댑터의 순수 로직(입력 검증·응답 해석·오류 분류)과 암호화 왕복. 네트워크 없음. */
class KarrotAdsClientTest {

    private final KarrotAdsClient client = new KarrotAdsClient("http://127.0.0.1:9");

    @Test
    @DisplayName("키·광고계정 ID 형식을 검증한다")
    void validatesCredentials() {
        assertThatThrownBy(() -> client.normalizeCredentials(Map.of("apiKey", "short", "advertiserId", "1")))
                .isInstanceOf(InvalidSubmissionException.class);
        assertThatThrownBy(() -> client.normalizeCredentials(Map.of("apiKey", "long-enough-key", "advertiserId", "a1")))
                .isInstanceOf(InvalidSubmissionException.class);
        assertThat(client.normalizeCredentials(Map.of("apiKey", "  long-enough-key ", "advertiserId", " 42 ")))
                .containsEntry("apiKey", "long-enough-key").containsEntry("advertiserId", "42");
        assertThat(client.credentialsHint(Map.of("apiKey", "long-enough-key", "advertiserId", "42")))
                .contains("42").contains("-key").doesNotContain("long-enough");
    }

    @Test
    @DisplayName("다른 광고계정으로는 조작하지 않는다")
    void rejectsOtherAccount() {
        assertThatThrownBy(() -> client.setCampaignActive(Map.of("apiKey", "k", "advertiserId", "1"), "2", "c", false))
                .isInstanceOf(AdPlatformException.class);
    }

    @Test
    @DisplayName("캠페인 응답을 해석한다 — 검색광고는 조회 전용")
    void parsesCampaign() {
        JsonMapper json = JsonMapper.builder().build();
        AdCampaign on = KarrotAdsClient.toCampaign(json.readTree(
                "{\"id\":\"10\",\"title\":\"치과\",\"type\":\"Display\",\"liveStatus\":\"ON\",\"status\":\"NORMAL\"}"));
        assertThat(on.active()).isTrue();
        assertThat(on.readOnly()).isFalse();
        assertThat(on.statusLabel()).isEqualTo("운영 중");

        AdCampaign search = KarrotAdsClient.toCampaign(json.readTree(
                "{\"id\":\"11\",\"title\":\"검색\",\"type\":\"Search\",\"liveStatus\":\"OFF\",\"status\":\"OFF\"}"));
        assertThat(search.active()).isFalse();
        assertThat(search.readOnly()).isTrue();
    }

    @Test
    @DisplayName("HTTP 상태를 원인별로 분류한다")
    void classifiesErrors() {
        assertThat(KarrotAdsClient.toError(401, "").kind()).isEqualTo(AdPlatformException.Kind.AUTH_INVALID);
        assertThat(KarrotAdsClient.toError(403, "").kind()).isEqualTo(AdPlatformException.Kind.AUTH_INVALID);
        assertThat(KarrotAdsClient.toError(429, "").kind()).isEqualTo(AdPlatformException.Kind.RATE_LIMITED);
        assertThat(KarrotAdsClient.toError(404, "").kind()).isEqualTo(AdPlatformException.Kind.NOT_FOUND);
        assertThat(KarrotAdsClient.toError(503, "").kind()).isEqualTo(AdPlatformException.Kind.TEMPORARY);
        assertThat(KarrotAdsClient.toError(400, "bad").kind()).isEqualTo(AdPlatformException.Kind.OTHER);
    }

    @Test
    @DisplayName("연결할 수 없으면 일시 오류로 분류한다")
    void networkFailureIsTemporary() {
        assertThatThrownBy(() -> client.listAccounts(Map.of("apiKey", "k", "advertiserId", "1")))
                .isInstanceOfSatisfying(AdPlatformException.class,
                        e -> assertThat(e.kind()).isEqualTo(AdPlatformException.Kind.TEMPORARY));
    }

    @Test
    @DisplayName("암호화 왕복 — 키가 없으면 저장을 거절한다")
    void cipherRoundTrip() {
        CredentialCipher cipher = new CredentialCipher("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=");
        String enc = cipher.encrypt(Map.of("apiKey", "secret"));
        assertThat(enc).startsWith("v1:").doesNotContain("secret");
        assertThat(cipher.decrypt(enc)).containsEntry("apiKey", "secret");
        assertThat(cipher.encrypt(Map.of("apiKey", "secret"))).isNotEqualTo(enc); // IV 매번 다름

        CredentialCipher none = new CredentialCipher("");
        assertThat(none.isConfigured()).isFalse();
        assertThatThrownBy(() -> none.encrypt(Map.of())).isInstanceOf(InvalidSubmissionException.class);
        assertThat(new CredentialCipher("not-base64!!").isConfigured()).isFalse(); // 기동은 막지 않는다
    }
}
