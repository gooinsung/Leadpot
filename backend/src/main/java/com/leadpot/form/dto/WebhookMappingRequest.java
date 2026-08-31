package com.leadpot.form.dto;

import java.util.List;
import java.util.Map;

/**
 * 웹훅 원본 키 매핑 저장 요청. answerMapping/consentMapping 의 키=원본 페이로드 키,
 * 값=리드폼 항목 라벨(FIELD)/질문(CHOICE) 또는 동의 항목 제목 — 그대로 매치돼야 한다(대소문자 포함).
 * externalIdKey 는 멱등성에 쓸 원본 키(비우면 페이로드 해시로 폴백).
 *
 * <p>alwaysAgreedConsents — 동의 제목 목록. 여기 포함된 동의 항목은 페이로드에 매핑된 값이 있든 없든
 * 항상 동의(agreed=true)로 처리한다. 원본이 이미 동의를 전제로만 데이터를 넘기는 경우를 위한 것
 * (예: 메타 잠재고객 폼은 동의 체크 없이는 애초에 제출 자체가 안 되므로, 시트에 들어온 행은 이미
 * 동의된 사람이다 — 그런데 시트에는 동의 여부를 나타내는 열 자체가 없을 수 있다).
 */
public record WebhookMappingRequest(
        Map<String, String> answerMapping,
        Map<String, String> consentMapping,
        String externalIdKey,
        List<String> alwaysAgreedConsents) {

    public Map<String, String> answerMappingOrEmpty() {
        return answerMapping == null ? Map.of() : answerMapping;
    }

    public Map<String, String> consentMappingOrEmpty() {
        return consentMapping == null ? Map.of() : consentMapping;
    }

    public List<String> alwaysAgreedConsentsOrEmpty() {
        return alwaysAgreedConsents == null ? List.of() : alwaysAgreedConsents;
    }
}
