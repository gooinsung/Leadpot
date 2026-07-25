package com.leadpot.landing.dto;

import java.time.Instant;
import java.util.List;

/** 동적 요소(M8) 실시간 집계 응답: 연결폼 활성 리드 수 + 최근 신청자(이름 마스킹). */
public record LandingLiveResponse(long count, List<Recent> recent) {

    /** 최근 신청자 1명: name=마스킹된 이름(김**), at=접수 시각. */
    public record Recent(String name, Instant at) {
    }
}
