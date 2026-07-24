package com.leadpot.stats;

import java.net.URI;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;

/** 리드 데이터 기반 통계 집계(본인 소유만 K5). */
@Service
public class StatsService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final int DAYS = 30;

    private final LeadRepository leadRepository;
    private final FormRepository formRepository;

    public StatsService(LeadRepository leadRepository, FormRepository formRepository) {
        this.leadRepository = leadRepository;
        this.formRepository = formRepository;
    }

    @Transactional(readOnly = true)
    public StatsResponse overview(Long ownerId) {
        List<Lead> leads = leadRepository.findAllByOwner(ownerId);
        Map<Long, String> formNames = new LinkedHashMap<>();
        for (Form f : formRepository.findByOwnerIdOrderByUpdatedAtDesc(ownerId)) {
            formNames.put(f.getId(), f.getName());
        }

        return new StatsResponse(
                leads.size(),
                byDay(leads),
                byKey(leads, l -> blankTo(l.getDevice(), "기타")),
                byKey(leads, l -> utmSource(l)),
                topReferers(leads),
                byForm(leads, formNames));
    }

    /** 최근 30일 일별(빈 날짜 0 포함, 날짜 오름차순). */
    private List<StatsResponse.Count> byDay(List<Lead> leads) {
        LocalDate today = LocalDate.now(KST);
        Map<LocalDate, Long> counts = new LinkedHashMap<>();
        for (int i = DAYS - 1; i >= 0; i--) {
            counts.put(today.minusDays(i), 0L);
        }
        for (Lead l : leads) {
            if (l.getCreatedAt() == null) continue;
            LocalDate d = l.getCreatedAt().atZone(KST).toLocalDate();
            if (counts.containsKey(d)) counts.merge(d, 1L, Long::sum);
        }
        List<StatsResponse.Count> out = new ArrayList<>();
        counts.forEach((d, c) -> out.add(new StatsResponse.Count(d.toString(), c)));
        return out;
    }

    private List<StatsResponse.Count> byKey(List<Lead> leads, java.util.function.Function<Lead, String> keyFn) {
        Map<String, Long> m = new LinkedHashMap<>();
        for (Lead l : leads) m.merge(keyFn.apply(l), 1L, Long::sum);
        return m.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(e -> new StatsResponse.Count(e.getKey(), e.getValue()))
                .toList();
    }

    private List<StatsResponse.Count> topReferers(List<Lead> leads) {
        return byKey(leads, l -> {
            String r = l.getReferer();
            if (r == null || r.isBlank()) return "직접 유입";
            try {
                String host = URI.create(r).getHost();
                return host == null || host.isBlank() ? r : host;
            } catch (Exception e) {
                return r;
            }
        }).stream().limit(10).toList();
    }

    private List<StatsResponse.FormCount> byForm(List<Lead> leads, Map<Long, String> names) {
        Map<Long, Long> m = new LinkedHashMap<>();
        for (Lead l : leads) m.merge(l.getFormId(), 1L, Long::sum);
        return m.entrySet().stream()
                .sorted(Map.Entry.<Long, Long>comparingByValue().reversed())
                .map(e -> new StatsResponse.FormCount(e.getKey(), names.getOrDefault(e.getKey(), "(삭제된 폼)"), e.getValue()))
                .sorted(Comparator.comparingLong(StatsResponse.FormCount::count).reversed())
                .toList();
    }

    @SuppressWarnings("unchecked")
    private static String utmSource(Lead l) {
        Object utm = l.getUtm();
        if (utm instanceof Map<?, ?> m) {
            Object s = ((Map<String, Object>) m).get("source");
            if (s != null && !s.toString().isBlank()) return s.toString();
        }
        return "직접/기타";
    }

    private static String blankTo(String s, String def) {
        return s == null || s.isBlank() ? def : s;
    }
}
