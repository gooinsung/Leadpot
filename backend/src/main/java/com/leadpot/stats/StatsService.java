package com.leadpot.stats;

import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.landing.LandingPage;
import com.leadpot.landing.LandingPageRepository;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;
import com.leadpot.visit.Visit;
import com.leadpot.visit.VisitRepository;

/** 리드·방문 데이터 기반 통계 집계(본인 소유만 K5). 기간·대상(랜딩/폼) 필터 지원. */
@Service
public class StatsService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final int DEFAULT_DAYS = 30;
    private static final int MAX_DAYS = 366;

    private static final Map<String, String> STATUS_KR = Map.of(
            "NEW", "신규", "IN_PROGRESS", "상담중", "DONE", "완료", "SPAM", "불량", "NORMAL", "정상");

    private final LeadRepository leadRepository;
    private final VisitRepository visitRepository;
    private final FormRepository formRepository;
    private final LandingPageRepository landingRepository;

    public StatsService(LeadRepository leadRepository, VisitRepository visitRepository,
            FormRepository formRepository, LandingPageRepository landingRepository) {
        this.leadRepository = leadRepository;
        this.visitRepository = visitRepository;
        this.formRepository = formRepository;
        this.landingRepository = landingRepository;
    }

    @Transactional(readOnly = true)
    public StatsResponse overview(Long ownerId, LocalDate from, LocalDate to, Long landingId, Long formId) {
        // 기간 정규화(KST). 미지정 시 최근 30일. 최대 366일로 제한.
        LocalDate today = LocalDate.now(KST);
        if (to == null) to = today;
        if (from == null) from = to.minusDays(DEFAULT_DAYS - 1L);
        if (from.isAfter(to)) {
            LocalDate t = from; from = to; to = t;
        }
        if (from.isBefore(to.minusDays(MAX_DAYS - 1L))) {
            from = to.minusDays(MAX_DAYS - 1L);
        }
        Instant fromInstant = from.atStartOfDay(KST).toInstant();
        Instant toInstant = to.plusDays(1).atStartOfDay(KST).toInstant(); // 반열림 [from, to+1)

        // 대상 필터(랜딩/폼) 적용해 로드
        final Long fLanding = landingId;
        final Long fForm = formId;
        List<Lead> leads = leadRepository.findByOwnerBetween(ownerId, fromInstant, toInstant).stream()
                .filter(l -> fLanding == null || fLanding.equals(l.getLandingPageId()))
                .filter(l -> fForm == null || fForm.equals(l.getFormId()))
                .toList();
        List<Visit> visits = visitRepository
                .findByOwnerIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(ownerId, fromInstant, toInstant).stream()
                .filter(v -> fLanding == null || fLanding.equals(v.getLandingPageId()))
                .filter(v -> fForm == null || fForm.equals(v.getFormId()))
                .toList();

        Map<Long, String> formNames = new LinkedHashMap<>();
        for (Form f : formRepository.findByOwnerIdOrderByUpdatedAtDesc(ownerId)) {
            formNames.put(f.getId(), f.getName());
        }
        Map<Long, String> landingNames = new LinkedHashMap<>();
        for (LandingPage lp : landingRepository.findByOwnerIdOrderByUpdatedAtDesc(ownerId)) {
            landingNames.put(lp.getId(), lp.getTitle());
        }

        long totalVisits = visits.size();
        long totalLeads = leads.size();

        return new StatsResponse(
                from.toString(),
                to.toString(),
                new StatsResponse.Summary(totalVisits, totalLeads, rate(totalLeads, totalVisits)),
                byDay(leads, visits, from, to),
                leadCounts(leads, l -> blankTo(l.getDevice(), "기타")),
                leadCounts(leads, l -> blankTo(l.getOs(), "기타")),
                leadCounts(leads, l -> blankTo(l.getBrowser(), "기타")),
                leadCounts(leads, l -> utm(l.getUtm(), "source")),
                leadCounts(leads, l -> utm(l.getUtm(), "medium")),
                leadCounts(leads, l -> utm(l.getUtm(), "campaign")),
                topReferers(leads),
                leadCounts(leads, l -> STATUS_KR.getOrDefault(l.getStatus(), l.getStatus())),
                byLanding(leads, visits, landingNames),
                byForm(leads, visits, formNames));
    }

    /** 기간 내 각 날짜의 방문/리드 수(빈 날짜 0, 오름차순). */
    private List<StatsResponse.DayPoint> byDay(List<Lead> leads, List<Visit> visits, LocalDate from, LocalDate to) {
        Map<LocalDate, long[]> m = new LinkedHashMap<>(); // [visits, leads]
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            m.put(d, new long[2]);
        }
        for (Visit v : visits) {
            if (v.getCreatedAt() == null) continue;
            long[] c = m.get(v.getCreatedAt().atZone(KST).toLocalDate());
            if (c != null) c[0]++;
        }
        for (Lead l : leads) {
            if (l.getCreatedAt() == null) continue;
            long[] c = m.get(l.getCreatedAt().atZone(KST).toLocalDate());
            if (c != null) c[1]++;
        }
        List<StatsResponse.DayPoint> out = new ArrayList<>();
        m.forEach((d, c) -> out.add(new StatsResponse.DayPoint(d.toString(), c[0], c[1])));
        return out;
    }

    private List<StatsResponse.Count> leadCounts(List<Lead> leads, Function<Lead, String> keyFn) {
        Map<String, Long> m = new LinkedHashMap<>();
        for (Lead l : leads) m.merge(keyFn.apply(l), 1L, Long::sum);
        return m.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(e -> new StatsResponse.Count(e.getKey(), e.getValue()))
                .toList();
    }

    private List<StatsResponse.Count> topReferers(List<Lead> leads) {
        return leadCounts(leads, l -> host(l.getReferer())).stream().limit(10).toList();
    }

    private List<StatsResponse.EntityCount> byLanding(List<Lead> leads, List<Visit> visits, Map<Long, String> names) {
        Map<Long, long[]> m = new LinkedHashMap<>(); // key: landingId(nullable→-1), [visits, leads]
        visits.forEach(v -> m.computeIfAbsent(nz(v.getLandingPageId()), k -> new long[2])[0]++);
        leads.forEach(l -> m.computeIfAbsent(nz(l.getLandingPageId()), k -> new long[2])[1]++);
        return toEntityCounts(m, id -> id == -1L ? "랜딩 없음(직접 폼)" : names.getOrDefault(id, "(삭제된 랜딩)"));
    }

    private List<StatsResponse.EntityCount> byForm(List<Lead> leads, List<Visit> visits, Map<Long, String> names) {
        Map<Long, long[]> m = new LinkedHashMap<>();
        visits.forEach(v -> m.computeIfAbsent(nz(v.getFormId()), k -> new long[2])[0]++);
        leads.forEach(l -> m.computeIfAbsent(nz(l.getFormId()), k -> new long[2])[1]++);
        return toEntityCounts(m, id -> id == -1L ? "폼 없음" : names.getOrDefault(id, "(삭제된 폼)"));
    }

    private List<StatsResponse.EntityCount> toEntityCounts(Map<Long, long[]> m, Function<Long, String> nameFn) {
        return m.entrySet().stream()
                .map(e -> {
                    Long id = e.getKey() == -1L ? null : e.getKey();
                    long v = e.getValue()[0], le = e.getValue()[1];
                    return new StatsResponse.EntityCount(id, nameFn.apply(e.getKey()), v, le, rate(le, v));
                })
                .sorted((a, b) -> Long.compare(b.leads() + b.visits(), a.leads() + a.visits()))
                .toList();
    }

    private static double rate(long leads, long visits) {
        if (visits <= 0) return 0d;
        return Math.round((leads * 10000d) / visits) / 100d; // 소수 2자리 %
    }

    private static long nz(Long v) {
        return v == null ? -1L : v;
    }

    private static String host(String referer) {
        if (referer == null || referer.isBlank()) return "직접 유입";
        try {
            String h = URI.create(referer).getHost();
            return h == null || h.isBlank() ? referer : h;
        } catch (Exception e) {
            return referer;
        }
    }

    @SuppressWarnings("unchecked")
    private static String utm(Map<String, Object> utm, String key) {
        if (utm != null) {
            Object s = ((Map<String, Object>) utm).get(key);
            if (s != null && !s.toString().isBlank()) return s.toString();
        }
        return "(없음)";
    }

    private static String blankTo(String s, String def) {
        return s == null || s.isBlank() ? def : s;
    }
}
