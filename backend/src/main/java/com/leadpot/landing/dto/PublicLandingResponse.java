package com.leadpot.landing.dto;

import java.util.List;
import java.util.Map;

import com.leadpot.form.dto.FormResponse;

/** 공개 랜딩 렌더 데이터(비로그인). content 블록 + FORM 블록이 참조하는 폼 정의(formId → FormResponse). */
public record PublicLandingResponse(
        Long id,
        String title,
        List<Map<String, Object>> content,
        Map<Long, FormResponse> forms) {
}
