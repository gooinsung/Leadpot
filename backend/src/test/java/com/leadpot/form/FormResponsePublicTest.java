package com.leadpot.form;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.leadpot.form.dto.FormResponse;

/**
 * 공개 응답에 운영 설정이 섞여 나가지 않는지 지키는 테스트.
 *
 * <p>공개 랜딩·공개 리드폼 응답은 <b>비로그인 누구나</b> 받아볼 수 있다. 여기에 리드폼의
 * {@code settingsConfig} 가 담기면 구글시트 시크릿·알림 수신번호·고객 문자 본문이 그대로 유출된다.
 * (2026-08-10 발견 — 시트 연동을 켜는 순간 시크릿이 공개되는 상태였다.)
 */
class FormResponsePublicTest {

    private static Form formWithSecrets() {
        Form form = new Form(1L, "테스트 리드폼", FormType.BASIC);
        form.setSettingsConfig(Map.of(
                "sheetsWebhookUrl", "https://script.google.com/macros/s/AAA/exec",
                "sheetsSecret", "super-secret",
                "smsMarketerPhone", "01012345678",
                "smsLeadBody", "{{f1}} 님 접수되었습니다"));
        form.setStyleConfig(Map.of("accentColor", "#3a43c0"));
        form.setTrackingConfig(Map.of("meta", "123456789012345"));
        form.setConsentConfig(Map.of("items", java.util.List.of()));
        return form;
    }

    @Test
    @DisplayName("공개 응답에는 settingsConfig 가 담기지 않는다")
    void 공개_응답은_운영설정을_빼고_내려준다() {
        FormResponse res = FormResponse.publicOf(formWithSecrets());

        assertNull(res.settingsConfig(), "공개 응답에 settingsConfig 가 담기면 시트 시크릿·알림번호가 유출된다");
    }

    @Test
    @DisplayName("공개 응답에도 렌더에 필요한 설정은 그대로 담긴다")
    void 공개_렌더에_필요한_값은_유지된다() {
        FormResponse res = FormResponse.publicOf(formWithSecrets());

        assertNotNull(res.consentConfig(), "동의 항목은 공개 폼이 그려야 한다");
        assertNotNull(res.styleConfig(), "색상은 공개 폼이 써야 한다");
        assertNotNull(res.trackingConfig(), "픽셀은 공개 페이지에서 발사한다");
        assertEquals("테스트 리드폼", res.name());
    }

    @Test
    @DisplayName("소유자 응답에는 settingsConfig 가 그대로 담긴다")
    void 소유자_응답은_운영설정을_준다() {
        FormResponse res = FormResponse.from(formWithSecrets());

        assertNotNull(res.settingsConfig(), "편집 화면이 읽어야 하므로 소유자 응답에는 남아야 한다");
        assertEquals("super-secret", res.settingsConfig().get("sheetsSecret"));
    }
}
