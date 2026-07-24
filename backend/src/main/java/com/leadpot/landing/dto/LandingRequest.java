package com.leadpot.landing.dto;

import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 랜딩 생성/수정 요청. content = 블록 배열(이미지/텍스트/HTML/리드폼). slug 미지정 시 자동 생성. */
public record LandingRequest(
        @NotBlank @Size(max = 255) String title,
        List<Map<String, Object>> content,
        String status,
        @Size(max = 120) String slug,
        Map<String, Object> tracking) {

    public List<Map<String, Object>> contentOrEmpty() {
        return content == null ? List.of() : content;
    }
}
