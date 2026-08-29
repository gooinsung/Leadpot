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

import com.leadpot.event.InteractionEvent;
import com.leadpot.event.InteractionEventRepository;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.landing.LandingPage;
import com.leadpot.landing.LandingPageRepository;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;
import com.leadpot.visit.Visit;
import com.leadpot.visit.VisitRepository;

/** 리드·방문 데이터 기반 통계 집계(본인 소유만 K5). 기간·대상(랜딩/리드폼) 필터 지원. */
@Service
public class StatsService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final int DEFAULT_DAYS = 30;
    private static final int MAX_DAYS = 366;

    private final LeadRepository leadRepository;
    private final VisitRepository visitRepository;
    private final FormRepository formRepository;
    private final LandingPageRepository landingRepository;
    private final InteractionEventRepository eventRepository;
    private final com.leadpot.lead.CustomLeadStatusRepository customStatusRepository;

    public StatsService(LeadRepository leadRepository, VisitRepository visitRepository,
            FormRepository formRepository, LandingPageRepository landingRepository,
            InteractionEventRepository eventRepository,
            com.leadpot.lead.CustomLeadStatusRepository customStatusRepository) {
        this.leadRepository = leadRepository;
        this.visitRepository = visitRepository;
        this.formRepository = formRepository;
        this.landingRepository = landingRepository;
        this.eventRepository = eventRepository;
        this.customStatusRepository = customStatusRepository;
    }

    @Transactional(readOnly = true)
    public StatsResponse overview(Long ownerId, LocalDate from, LocalDate to, Long landingId, Long formId) {
        return overview(ownerId, from, to, landingId, formId, null, null);
    }

    /**
     * 통계 집계. utmKey+utmValue 를 주면 그 유입만으로 전체(요약·추이·카드·표)를 재계산한다.
     * "(없음)" 값은 유입 파라미터가 없는(오가닉/직접) 방문·리드를 뜻한다.
     */
    @Transactional(readOnly = true)
    public StatsResponse overview(Long ownerId, LocalDate from, LocalDate to, Long landingId, Long formId,
            String utmKey, String utmValue) {
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

        // 대상 필터(랜딩/리드폼) 적용해 로드
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
        List<InteractionEvent> events = eventRepository
                .findByOwnerIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(ownerId, fromInstant, toInstant).stream()
                .filter(e -> fLanding == null || fLanding.equals(e.getLandingPageId()))
                .filter(e -> fForm == null || fForm.equals(e.getFormId()))
                .toList();

        // 유입별 비교 표는 유입 필터가 걸리기 전 데이터로 만든다 — 한 값을 골라도 표에서 다른 값과 비교할 수 있게.
        List<StatsResponse.UtmTable> utmTables = List.of(
                utmTable("media_from", leads, visits),
                utmTable("campaign_name", leads, visits),
                utmTable("ads_name", leads, visits));

        // 유입 필터 — 그 유입의 리드·방문만 남긴다. "(없음)" 은 파라미터 없는(오가닉) 것.
        if (utmKey != null && !utmKey.isBlank() && utmValue != null && !utmValue.isBlank()) {
            final String uk = utmKey.trim();
            final String uv = utmValue.trim();
            leads = leads.stream().filter(l -> uv.equals(utm(l.getUtm(), uk))).toList();
            visits = visits.stream().filter(v -> uv.equals(utm(v.getUtm(), uk))).toList();
            // 이벤트(요소 클릭)에는 utm 이 없다 → 남은 방문의 방문자(IP 해시)로 귀속시킨다(근사).
            java.util.Set<String> ipHashes = new java.util.HashSet<>();
            for (Visit v : visits) {
                if (v.getIpHash() != null && !v.getIpHash().isBlank()) ipHashes.add(v.getIpHash());
            }
            events = events.stream()
                    .filter(e -> e.getIpHash() != null && ipHashes.contains(e.getIpHash()))
                    .toList();
        }

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

        long uniqueVisits = uniqueCount(visits);

        return new StatsResponse(
                from.toString(),
                to.toString(),
                new StatsResponse.Summary(uniqueVisits, totalVisits, totalLeads, rate(totalLeads, uniqueVisits)),
                byDay(leads, visits, from, to),
                leadCounts(leads, l -> blankTo(l.getDevice(), "기타")),
                leadCounts(leads, l -> blankTo(l.getOs(), "기타")),
                leadCounts(leads, l -> blankTo(l.getBrowser(), "기타")),
                leadCounts(leads, l -> utm(l.getUtm(), "source")),
                leadCounts(leads, l -> utm(l.getUtm(), "medium")),
                leadCounts(leads, l -> utm(l.getUtm(), "campaign")),
                leadCounts(leads, l -> utm(l.getUtm(), "media_from")),
                leadCounts(leads, l -> utm(l.getUtm(), "campaign_name")),
                leadCounts(leads, l -> utm(l.getUtm(), "ads_name")),
                topReferers(leads),
                leadCounts(leads, statusLabeler(leads)),
                byLanding(leads, visits, landingNames),
                byForm(leads, visits, formNames),
                utmTables,
                funnel(uniqueVisits, events, totalLeads),
                byEvent(events),
                journey(uniqueVisits, events));
    }

    /** 상태 라벨 함수(통합 축 V29) — 등장한 커스텀 상태 이름을 한 번에 조회해 붙인다. */
    private java.util.function.Function<Lead, String> statusLabeler(List<Lead> leads) {
        java.util.Set<Long> ids = new java.util.HashSet<>();
        for (Lead l : leads) {
            if (l.getCustomStatusId() != null) {
                ids.add(l.getCustomStatusId());
            }
        }
        Map<Long, String> names = new LinkedHashMap<>();
        if (!ids.isEmpty()) {
            customStatusRepository.findAllById(ids).forEach(s -> names.put(s.getId(), s.getName()));
        }
        return l -> com.leadpot.lead.LeadStatuses.label(l.getStatus(),
                l.getCustomStatusId() == null ? null : names.get(l.getCustomStatusId()));
    }

    /** 전환 퍼널: 순방문 → 폼 열기(고유 방문자) → 접수. */
    private StatsResponse.Funnel funnel(long uniqueVisits, List<InteractionEvent> events, long leads) {
        long formOpens = events.stream()
                .filter(e -> "form_open".equals(e.getEventType()))
                .map(InteractionEvent::getIpHash)
                .filter(h -> h != null && !h.isBlank())
                .distinct().count();
        return new StatsResponse.Funnel(uniqueVisits, formOpens, leads,
                rate(formOpens, uniqueVisits), rate(leads, formOpens));
    }

    private static final int[] SCROLL_DEPTHS = {25, 50, 75, 100};

    /**
     * 고객 여정(I6): 스크롤 임계값별 도달률(순방문 대비) + 평균 체류 시간(page_exit 이벤트) + 즉시 이탈률.
     * 스크롤·이탈 이벤트는 IP 해시로 순방문과 대응시킨다(전환 퍼널과 같은 근사 방식).
     */
    private StatsResponse.Journey journey(long uniqueVisits, List<InteractionEvent> events) {
        List<StatsResponse.ScrollPoint> scrollFunnel = new ArrayList<>();
        for (int depth : SCROLL_DEPTHS) {
            long reached = events.stream()
                    .filter(e -> "scroll".equals(e.getEventType())
                            && e.getScrollDepth() != null && e.getScrollDepth() >= depth)
                    .map(InteractionEvent::getIpHash)
                    .filter(h -> h != null && !h.isBlank())
                    .distinct()
                    .count();
            scrollFunnel.add(new StatsResponse.ScrollPoint(depth, reached, rate(reached, uniqueVisits)));
        }

        double rawAvgDuration = events.stream()
                .filter(e -> "page_exit".equals(e.getEventType()) && e.getDurationSec() != null)
                .mapToInt(InteractionEvent::getDurationSec)
                .average()
                .orElse(0d);
        double avgDurationSec = Math.round(rawAvgDuration * 10d) / 10d;

        long reached25 = scrollFunnel.get(0).reached();
        double bounceRate = rate(Math.max(0, uniqueVisits - reached25), uniqueVisits);

        return new StatsResponse.Journey(uniqueVisits, avgDurationSec, bounceRate, scrollFunnel);
    }

    /** 요소 클릭 집계(대상 라벨별 총 클릭 수, 내림차순 상위 20). 라벨 없으면 이벤트 유형으로. */
    private List<StatsResponse.Count> byEvent(List<InteractionEvent> events) {
        Map<String, Long> m = new LinkedHashMap<>();
        for (InteractionEvent e : events) {
            String key = e.getTarget() != null && !e.getTarget().isBlank() ? e.getTarget() : e.getEventType();
            m.merge(key, 1L, Long::sum);
        }
        return m.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(20)
                .map(e -> new StatsResponse.Count(e.getKey(), e.getValue()))
                .toList();
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
        return byEntity(leads, visits, l -> nz(l.getLandingPageId()), v -> nz(v.getLandingPageId()),
                id -> id == -1L ? "랜딩 없음(직접 리드폼)" : names.getOrDefault(id, "(삭제된 랜딩)"));
    }

    private List<StatsResponse.EntityCount> byForm(List<Lead> leads, List<Visit> visits, Map<Long, String> names) {
        return byEntity(leads, visits, l -> nz(l.getFormId()), v -> nz(v.getFormId()),
                id -> id == -1L ? "리드폼 없음" : names.getOrDefault(id, "(삭제된 리드폼)"));
    }

    /** 대상(랜딩/리드폼)별 순방문/총트래픽/리드/전환율 집계. */
    private List<StatsResponse.EntityCount> byEntity(List<Lead> leads, List<Visit> visits,
            Function<Lead, Long> leadKey, Function<Visit, Long> visitKey, Function<Long, String> nameFn) {
        Map<Long, List<Visit>> visitsByKey = new LinkedHashMap<>();
        Map<Long, Long> leadsByKey = new LinkedHashMap<>();
        for (Visit v : visits) visitsByKey.computeIfAbsent(visitKey.apply(v), k -> new ArrayList<>()).add(v);
        for (Lead l : leads) leadsByKey.merge(leadKey.apply(l), 1L, Long::sum);

        java.util.Set<Long> keys = new java.util.LinkedHashSet<>();
        keys.addAll(visitsByKey.keySet());
        keys.addAll(leadsByKey.keySet());

        return keys.stream()
                .map(key -> {
                    List<Visit> vs = visitsByKey.getOrDefault(key, List.of());
                    long total = vs.size();
                    long unique = uniqueCount(vs);
                    long le = leadsByKey.getOrDefault(key, 0L);
                    Long id = key == -1L ? null : key;
                    return new StatsResponse.EntityCount(id, nameFn.apply(key), unique, total, le, rate(le, unique));
                })
                .sorted((a, b) -> Long.compare(b.leads() + b.totalVisits(), a.leads() + a.totalVisits()))
                .toList();
    }

    /**
     * 유입 파라미터 한 키의 값별 성과 표. 방문·리드 양쪽에 같은 키가 저장돼 있어
     * 값별 방문·전환율이 실제로 계산된다. 정렬은 리드 많은 순 → 방문 많은 순.
     */
    private StatsResponse.UtmTable utmTable(String key, List<Lead> leads, List<Visit> visits) {
        Map<String, List<Visit>> visitsByValue = new LinkedHashMap<>();
        Map<String, Long> leadsByValue = new LinkedHashMap<>();
        for (Visit v : visits) visitsByValue.computeIfAbsent(utm(v.getUtm(), key), k -> new ArrayList<>()).add(v);
        for (Lead l : leads) leadsByValue.merge(utm(l.getUtm(), key), 1L, Long::sum);

        java.util.Set<String> values = new java.util.LinkedHashSet<>();
        values.addAll(visitsByValue.keySet());
        values.addAll(leadsByValue.keySet());

        List<StatsResponse.UtmRow> rows = values.stream()
                .map(value -> {
                    List<Visit> vs = visitsByValue.getOrDefault(value, List.of());
                    long total = vs.size();
                    long unique = uniqueCount(vs);
                    long le = leadsByValue.getOrDefault(value, 0L);
                    return new StatsResponse.UtmRow(value, unique, total, le, rate(le, unique));
                })
                .sorted((a, b) -> a.leads() == b.leads()
                        ? Long.compare(b.totalVisits(), a.totalVisits())
                        : Long.compare(b.leads(), a.leads()))
                .toList();
        return new StatsResponse.UtmTable(key, rows);
    }

    /** 고유 방문 수 = IP 해시 distinct(해시 없는 방문은 식별 불가라 제외). */
    private static long uniqueCount(List<Visit> visits) {
        java.util.Set<String> ips = new java.util.HashSet<>();
        for (Visit v : visits) {
            if (v.getIpHash() != null && !v.getIpHash().isBlank()) ips.add(v.getIpHash());
        }
        return ips.size();
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
