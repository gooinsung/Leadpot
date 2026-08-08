package com.leadpot.form;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;

/**
 * 목표 보고서(2026-08-09) — 목표가 켜진 리드폼별로 일간/월간 목표 대비 실적을 집계한다.
 *
 * <p>집계는 접수 수(휴지통 제외) 기준·KST 날짜 경계. 리드를 불러와 자바에서 버킷팅한다 —
 * 날짜 group by 는 DB 방언을 타고(H2 테스트), 폼당 리드 수 규모에서는 이쪽이 단순하고 충분하다.
 */
@Service
public class GoalReportService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    /** 일별 표 최대 길이 — 기간이 길어도 보고서가 무한히 길어지지 않게 최근 N일만. */
    private static final int MAX_DAILY_ROWS = 31;

    private final FormRepository formRepository;
    private final LeadRepository leadRepository;

    public GoalReportService(FormRepository formRepository, LeadRepository leadRepository) {
        this.formRepository = formRepository;
        this.leadRepository = leadRepository;
    }

    /** 하루치 실적. met = 일간 목표 달성(목표가 0이면 판정 없음 → null). */
    public record DayRow(String date, long count, Boolean met) {
    }

    /** 한 달치 실적. met = 월간 목표 달성(진행 중인 달은 아직 미달이어도 false 로 두지 않고 null). */
    public record MonthRow(String month, long count, Boolean met) {
    }

    public record GoalReportRow(
            Long formId,
            String formName,
            int dailyTarget,
            int monthlyTarget,
            String startDate,
            String endDate,
            /** 오늘이 기간 안인지(종료된 목표도 보고서에는 남는다). */
            boolean active,
            long todayCount,
            long monthCount,
            /** 기간 전체 누적 접수. */
            long totalCount,
            /** 기간 경과율(0~1) — 진행 감각용. */
            double periodProgress,
            List<DayRow> days,
            List<MonthRow> months) {
    }

    /** 목표가 켜진 내 리드폼 전부의 보고서. */
    @Transactional(readOnly = true)
    public List<GoalReportRow> report(Long ownerId) {
        LocalDate today = LocalDate.now(KST);
        List<GoalReportRow> out = new ArrayList<>();
        for (Form form : formRepository.findByOwnerIdOrderByUpdatedAtDesc(ownerId)) {
            GoalSettings goal = GoalSettings.from(form.getSettingsConfig());
            if (!goal.enabled()) {
                continue;
            }
            out.add(buildRow(form, goal, today));
        }
        return out;
    }

    private GoalReportRow buildRow(Form form, GoalSettings goal, LocalDate today) {
        Instant from = goal.start().atStartOfDay(KST).toInstant();
        Instant to = goal.end().plusDays(1).atStartOfDay(KST).toInstant();

        // 기간 내 접수 리드를 KST 날짜로 버킷팅
        Map<LocalDate, Long> byDay = new LinkedHashMap<>();
        for (Lead l : leadRepository.findByFormIdAndDeletedAtIsNullOrderByCreatedAtDesc(form.getId())) {
            Instant at = l.getCreatedAt();
            if (at == null || at.isBefore(from) || !at.isBefore(to)) {
                continue;
            }
            byDay.merge(at.atZone(KST).toLocalDate(), 1L, Long::sum);
        }
        long total = byDay.values().stream().mapToLong(Long::longValue).sum();
        long todayCount = byDay.getOrDefault(today, 0L);

        // 일별 표 — 시작일~min(오늘, 종료일) 을 최신순으로, 최근 31일까지만
        List<DayRow> days = new ArrayList<>();
        LocalDate cursor = today.isBefore(goal.end()) ? today : goal.end();
        while (!cursor.isBefore(goal.start()) && days.size() < MAX_DAILY_ROWS) {
            long n = byDay.getOrDefault(cursor, 0L);
            Boolean met = goal.daily() > 0 ? n >= goal.daily() : null;
            days.add(new DayRow(cursor.toString(), n, met));
            cursor = cursor.minusDays(1);
        }

        // 월별 표 — 기간에 걸친 달들(최신순). 진행 중인 달의 달성 판정은 보류(null).
        Map<YearMonth, Long> byMonth = new LinkedHashMap<>();
        byDay.forEach((d, n) -> byMonth.merge(YearMonth.from(d), n, Long::sum));
        List<MonthRow> months = new ArrayList<>();
        YearMonth mCursor = YearMonth.from(today.isBefore(goal.end()) ? today : goal.end());
        YearMonth first = YearMonth.from(goal.start());
        while (!mCursor.isBefore(first)) {
            long n = byMonth.getOrDefault(mCursor, 0L);
            Boolean met;
            if (goal.monthly() <= 0) {
                met = null;
            } else if (mCursor.equals(YearMonth.from(today)) && !today.isAfter(goal.end())) {
                met = n >= goal.monthly() ? Boolean.TRUE : null; // 진행 중인 달 — 미달을 실패로 찍지 않는다
            } else {
                met = n >= goal.monthly();
            }
            months.add(new MonthRow(mCursor.toString(), n, met));
            mCursor = mCursor.minusMonths(1);
        }

        long monthCount = byMonth.getOrDefault(YearMonth.from(today), 0L);
        long periodDays = goal.end().toEpochDay() - goal.start().toEpochDay() + 1;
        long elapsed = Math.min(Math.max(today.toEpochDay() - goal.start().toEpochDay() + 1, 0), periodDays);

        return new GoalReportRow(
                form.getId(), form.getName(),
                goal.daily(), goal.monthly(),
                goal.start().toString(), goal.end().toString(),
                goal.activeOn(today),
                todayCount, monthCount, total,
                periodDays == 0 ? 0 : (double) elapsed / periodDays,
                days, months);
    }
}
