package com.leadpot.form;

/**
 * 리드폼의 유입 방식. {@link FormType} 이 "화면을 어떻게 그리는가"라면, 이건 "리드가 어떻게 들어오는가"다.
 * - SELF: 우리 공개 URL(/f/{id})로 방문자가 직접 제출(기본값).
 * - WEBHOOK: 공개 렌더를 막고, 대신 토큰 기반 웹훅 URL 로 외부 도구(Zapier·Make·LeadsBridge 등)의
 *   리드를 받는다. 벤더에 종속되지 않는 범용 인바운드 수신 기능(docs/META-LEADS-PLAN.md).
 */
public enum FormSource {
    SELF,
    WEBHOOK
}
