package com.leadpot.stats;

import java.util.LinkedHashMap;
import java.util.List;

import org.springframework.stereotype.Service;

import com.leadpot.lead.LeadExcelService;

/**
 * 통계 보고서 엑셀 생성 — 화면 필터(기간·대상·유입) 그대로 집계한 {@link StatsResponse} 를
 * 섹션 선택에 따라 시트로 변환한다.
 *
 * <p><b>섹션 키는 프론트({@code StatsPage} 보고서 모달)와 계약이다</b> — 나중에
 * "광고주에게 리포트 발송"도 같은 키 목록(기간 + 필터 + 섹션)으로 보고서를 정의한다.
 * 지원 키: summary·trend·utm·landing·form·device·status·referer.
 * 모르는 키는 조용히 무시하고, 비어 있으면 전부 포함한다.
 */
@Service
public class StatsExportService {

    /** 시트 생성 순서 = 보고서 섹션 순서. */
    private static final List<String> ALL_SECTIONS =
            List.of("summary", "trend", "utm", "landing", "form", "device", "status", "referer");

    private final LeadExcelService excel;

    public StatsExportService(LeadExcelService excel) {
        this.excel = excel;
    }

    public byte[] xlsx(StatsResponse stats, List<String> sections) {
        List<String> pick = sections == null || sections.isEmpty() ? ALL_SECTIONS
                : ALL_SECTIONS.stream().filter(sections::contains).toList();
        LinkedHashMap<String, List<List<String>>> sheets = new LinkedHashMap<>();
        for (String s : pick) {
            switch (s) {
                case "summary" -> sheets.put("요약", summary(stats));
                case "trend" -> sheets.put("일별 추이", trend(stats));
                case "utm" -> {
                    sheets.put("유입-광고 매체", utm(stats, "media_from"));
                    sheets.put("유입-캠페인 이름", utm(stats, "campaign_name"));
                    sheets.put("유입-광고 이름", utm(stats, "ads_name"));
                }
                case "landing" -> sheets.put("랜딩페이지별", entity(stats.byLanding()));
                case "form" -> sheets.put("리드폼별", entity(stats.byForm()));
                case "device" -> sheets.put("기기·환경", device(stats));
                case "status" -> sheets.put("리드 상태", counts(stats.byStatus(), "상태"));
                case "referer" -> sheets.put("유입 경로", counts(stats.byReferer(), "유입 경로"));
                default -> { /* 모르는 키 무시 */ }
            }
        }
        if (sheets.isEmpty()) {
            sheets.put("요약", summary(stats)); // 전부 걸러졌어도 빈 파일은 만들지 않는다
        }
        return excel.dataXlsxSheets(sheets);
    }

    private static List<List<String>> summary(StatsResponse s) {
        return List.of(
                List.of("항목", "값"),
                List.of("기간", s.from() + " ~ " + s.to()),
                List.of("순 방문(고유)", String.valueOf(s.summary().uniqueVisits())),
                List.of("총 트래픽(중복 포함)", String.valueOf(s.summary().totalVisits())),
                List.of("접수(리드)", String.valueOf(s.summary().leads())),
                List.of("전환율(리드/순방문 %)", String.valueOf(s.summary().conversionRate())),
                List.of("퍼널: 폼 열기(고유)", String.valueOf(s.funnel().formOpens())),
                List.of("퍼널: 방문→폼열기 %", String.valueOf(s.funnel().openRate())),
                List.of("퍼널: 폼열기→접수 %", String.valueOf(s.funnel().submitRate())));
    }

    private static List<List<String>> trend(StatsResponse s) {
        List<List<String>> m = new java.util.ArrayList<>();
        m.add(List.of("날짜", "방문(트래픽)", "리드"));
        for (StatsResponse.DayPoint p : s.byDay()) {
            m.add(List.of(p.date(), String.valueOf(p.visits()), String.valueOf(p.leads())));
        }
        return m;
    }

    private static List<List<String>> utm(StatsResponse s, String key) {
        List<List<String>> m = new java.util.ArrayList<>();
        m.add(List.of("값", "순 방문", "총 트래픽", "리드", "전환율(%)"));
        s.byUtmTables().stream().filter(t -> key.equals(t.key())).findFirst()
                .ifPresent(t -> t.rows().forEach(r -> m.add(List.of(
                        r.value(), String.valueOf(r.uniqueVisits()), String.valueOf(r.totalVisits()),
                        String.valueOf(r.leads()), String.valueOf(r.conversionRate())))));
        return m;
    }

    private static List<List<String>> entity(List<StatsResponse.EntityCount> rows) {
        List<List<String>> m = new java.util.ArrayList<>();
        m.add(List.of("이름", "순 방문", "총 트래픽", "리드", "전환율(%)"));
        for (StatsResponse.EntityCount r : rows) {
            m.add(List.of(r.name(), String.valueOf(r.uniqueVisits()), String.valueOf(r.totalVisits()),
                    String.valueOf(r.leads()), String.valueOf(r.conversionRate())));
        }
        return m;
    }

    /** 기기·OS·브라우저를 한 시트에(구분 열로). */
    private static List<List<String>> device(StatsResponse s) {
        List<List<String>> m = new java.util.ArrayList<>();
        m.add(List.of("구분", "값", "리드 수"));
        s.byDevice().forEach(c -> m.add(List.of("기기", c.key(), String.valueOf(c.count()))));
        s.byOs().forEach(c -> m.add(List.of("OS", c.key(), String.valueOf(c.count()))));
        s.byBrowser().forEach(c -> m.add(List.of("브라우저", c.key(), String.valueOf(c.count()))));
        return m;
    }

    private static List<List<String>> counts(List<StatsResponse.Count> rows, String label) {
        List<List<String>> m = new java.util.ArrayList<>();
        m.add(List.of(label, "리드 수"));
        for (StatsResponse.Count c : rows) {
            m.add(List.of(c.key(), String.valueOf(c.count())));
        }
        return m;
    }
}
