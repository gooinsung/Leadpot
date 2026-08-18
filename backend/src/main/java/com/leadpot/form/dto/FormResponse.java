package com.leadpot.form.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.leadpot.form.Form;
import com.leadpot.form.FormType;

/** 리드폼 상세 응답. */
public record FormResponse(
        Long id,
        String name,
        /** 분야(업종 구분, V34). null 가능. */
        String category,
        FormType formType,
        boolean requirePhoneVerification,
        Map<String, Object> consentConfig,
        Map<String, Object> submitButtonConfig,
        Map<String, Object> successConfig,
        Map<String, Object> typeConfig,
        Map<String, Object> styleConfig,
        Map<String, Object> settingsConfig,
        Map<String, Object> trackingConfig,
        List<FormBlockDto> blocks,
        Instant createdAt,
        Instant updatedAt) {

    /** 소유자(마케터)용 — 운영 설정까지 그대로 담는다. */
    public static FormResponse from(Form form) {
        return build(form, form.getSettingsConfig());
    }

    /**
     * 공개 렌더용 — <b>{@code settingsConfig} 를 빼고</b> 내려준다.
     *
     * <p>여기엔 방문자에게 보일 이유가 없는 운영 정보가 들어 있다:
     * 구글시트 웹훅 URL·시크릿, 마케터/광고주 알림 수신번호, 고객 문자 본문, 자동승인·목표 설정 등.
     * 공개 페이지 응답은 누구나 열어볼 수 있으므로 담으면 그대로 유출이다.
     *
     * <p>공개 화면(PublicFormView)은 이 값을 쓰지 않는다 — 렌더에 필요한 것은
     * consent/submit/success/type/style/tracking + blocks 뿐이다.
     */
    public static FormResponse publicOf(Form form) {
        return build(form, null);
    }

    private static FormResponse build(Form form, Map<String, Object> settingsConfig) {
        List<FormBlockDto> blocks = form.getBlocks().stream().map(FormBlockDto::from).toList();
        return new FormResponse(
                form.getId(),
                form.getName(),
                form.getCategory(),
                form.getFormType(),
                form.isRequirePhoneVerification(),
                form.getConsentConfig(),
                form.getSubmitButtonConfig(),
                form.getSuccessConfig(),
                form.getTypeConfig(),
                form.getStyleConfig(),
                settingsConfig,
                form.getTrackingConfig(),
                blocks,
                form.getCreatedAt(),
                form.getUpdatedAt());
    }
}
