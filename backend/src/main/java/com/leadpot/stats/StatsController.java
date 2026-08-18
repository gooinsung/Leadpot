package com.leadpot.stats;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 통계 API (로그인 필요, 본인 데이터만 K5). 기간·대상·유입 필터 지원. */
@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final StatsService statsService;
    private final StatsExportService exportService;

    public StatsController(StatsService statsService, StatsExportService exportService) {
        this.statsService = statsService;
        this.exportService = exportService;
    }

    @GetMapping("/overview")
    public StatsResponse overview(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long landingId,
            @RequestParam(required = false) Long formId,
            @RequestParam(required = false) String utmKey,
            @RequestParam(required = false) String utmValue) {
        return statsService.overview(Long.valueOf(jwt.getSubject()), from, to, landingId, formId, utmKey, utmValue);
    }

    /**
     * 통계 보고서 엑셀 — 화면 필터(기간·대상·유입) 그대로 + 섹션 선택.
     * body.sections 가 비어 있으면 전체 섹션. 섹션 키 목록은 {@link StatsExportService} 참고.
     */
    @PostMapping("/export")
    public ResponseEntity<byte[]> export(@AuthenticationPrincipal Jwt jwt, @RequestBody StatsExportRequest req) {
        StatsResponse stats = statsService.overview(Long.valueOf(jwt.getSubject()),
                req.from(), req.to(), req.landingId(), req.formId(), req.utmKey(), req.utmValue());
        byte[] body = exportService.xlsx(stats, req.sections());
        String filename = "stats_" + stats.from() + "_" + stats.to() + ".xlsx";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(body);
    }

    /** 보고서 정의 = 기간 + 필터 + 섹션 목록. 나중 '광고주 리포트 발송'도 이 모양을 재사용한다. */
    public record StatsExportRequest(
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Long landingId,
            Long formId,
            String utmKey,
            String utmValue,
            List<String> sections) {
    }
}
