package com.leadpot.lead.dto;

import java.util.List;

/**
 * 유입 파라미터 facet — "파라미터 이름 선택 → 그 이름의 값들이 드롭다운" 필터의 옵션 데이터.
 *
 * <p>키는 {@link com.leadpot.common.TrackingParams#ALLOWED_KEYS} 순서를 따르고,
 * 실제 리드에 등장한 키만 내려간다(빈 드롭다운을 만들지 않는다). 값은 많이 나온 순.
 *
 * <p>⚠️ '태그' 가 아니다 — {@code leads.tags}(마케터가 손으로 붙이는 VIP 등)와 별개 축이므로
 * 화면에서도 '유입/출처' 로 부른다.
 */
public record UtmFacet(String key, List<Value> values) {

    /** 한 값과 그 값이 등장한 리드 수. 드롭다운에 "danggun (12)" 처럼 보인다. */
    public record Value(String value, long count) {
    }
}
