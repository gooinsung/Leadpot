package com.leadpot.report;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.lead.LeadRepository;
import com.leadpot.sms.MessageLog;
import com.leadpot.sms.PhoneNumbers;
import com.leadpot.sms.SmsService;
import com.leadpot.sms.SolapiSmsSender;

/**
 * 리드 리포트 문자(V47, 사용자 지시 2026-11-01).
 *
 * <ul>
 * <li>아침 9시 — 오늘 00~09시(자는 동안) 접수 건수</li>
 * <li>밤 12시 — 어제 하루(00~24시) 접수 건수</li>
 * </ul>
 *
 * <p>결정 사항(사용자 확인 2026-11-01):
 * <ul>
 * <li><b>받는 사람은 마케터 본인만</b> — 광고주에게는 보내지 않는다</li>
 * <li><b>건수만</b> 담는다(총 건수·리드폼별 건수·전일 대비) — 이름·연락처 등 개인정보는 넣지 않는다</li>
 * <li><b>0건이면 보내지 않는다</b> — 빈 LMS 비용을 쓰지 않는다</li>
 * <li><b>기존 문자 권한·월 상한(V25)을 그대로 탄다</b> — 발송은 전부 {@link SmsService#send} 를 지나간다</li>
 * </ul>
 */
@Service
public class LeadReportService {

    private static final Logger log = LoggerFactory.getLogger(LeadReportService.class);

    /** 리드폼별 줄을 최대 몇 개까지 적을지. 넘치면 '외 N개 리드폼' 한 줄로 묶는다(LMS 2,000byte 안쪽 유지). */
    static final int MAX_FORM_LINES = 15;
    /** 리드폼 이름이 너무 길면 자른다. */
    private static final int MAX_FORM_NAME = 24;
    /** 리포트 문자는 본문이 길어 LMS 로 나간다 — 켤 때 이 채널 권한을 본다. */
    static final String CHANNEL = "LMS";

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("M/d(E)", Locale.KOREAN);

    private final LeadReportSettingsRepository settingsRepository;
    private final LeadRepository leadRepository;
    private final FormRepository formRepository;
    private final UserRepository userRepository;
    private final SmsService smsService;

    public LeadReportService(LeadReportSettingsRepository settingsRepository, LeadRepository leadRepository,
            FormRepository formRepository, UserRepository userRepository, SmsService smsService) {
        this.settingsRepository = settingsRepository;
        this.leadRepository = leadRepository;
        this.formRepository = formRepository;
        this.userRepository = userRepository;
        this.smsService = smsService;
    }

    // ---------- 설정 ----------

    /**
     * 설정 화면 응답.
     *
     * @param accountPhone 받을 번호를 비웠을 때 쓰는 계정 연락처(마스킹)
     * @param denyReason   지금 리포트 문자(LMS)를 보낼 수 없는 사유. null 이면 보낼 수 있다
     */
    public record SettingsView(boolean morningEnabled, boolean dailyEnabled, String phone,
            String accountPhone, String denyReason) {
    }

    @Transactional(readOnly = true)
    public SettingsView get(Long ownerId) {
        LeadReportSettings s = settingsRepository.findById(ownerId).orElse(null);
        return view(ownerId, s);
    }

    /**
     * 저장. <b>권한이 없으면 켤 수 없다</b>(끄는 건 언제나 된다) — 화면에서 잠가도 API 직접 호출로
     * 뚫리므로 여기서 다시 막는다. 발송 시점에도 {@link SmsService#send} 가 한 번 더 막는다.
     */
    @Transactional
    public SettingsView update(Long ownerId, boolean morningEnabled, boolean dailyEnabled, String phone) {
        LeadReportSettings s = settingsRepository.findById(ownerId).orElseGet(() -> new LeadReportSettings(ownerId));
        boolean turningOn = (morningEnabled && !s.isMorningEnabled()) || (dailyEnabled && !s.isDailyEnabled());
        if (turningOn) {
            String reason = smsService.denyReason(ownerId, CHANNEL);
            if (reason != null) {
                throw new InvalidSubmissionException("리포트 문자를 켤 수 없습니다. " + reason);
            }
        }
        String trimmed = phone == null ? "" : phone.trim();
        if (!trimmed.isEmpty() && PhoneNumbers.normalize(trimmed) == null) {
            throw new InvalidSubmissionException("받을 번호 형식이 올바르지 않습니다.");
        }
        s.setMorningEnabled(morningEnabled);
        s.setDailyEnabled(dailyEnabled);
        s.setPhone(trimmed.isEmpty() ? null : PhoneNumbers.normalize(trimmed));
        settingsRepository.save(s);
        return view(ownerId, s);
    }

    private SettingsView view(Long ownerId, LeadReportSettings s) {
        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new NotFoundException("계정을 찾을 수 없습니다."));
        return new SettingsView(
                s != null && s.isMorningEnabled(),
                s != null && s.isDailyEnabled(),
                s == null || s.getPhone() == null ? "" : s.getPhone(),
                PhoneNumbers.mask(owner.getPhone()),
                smsService.denyReason(ownerId, CHANNEL));
    }

    // ---------- 리포트 본문 ----------

    /** 미리보기 응답. {@code text} 가 null 이면 해당 구간 접수가 0건이라 발송되지 않는다. */
    public record Preview(String text, long total, String channel, int bytes) {
    }

    /** 가장 최근에 끝난 구간 기준 미리보기(발송하지 않는다). */
    @Transactional(readOnly = true)
    public Preview preview(Long ownerId, LeadReportKind kind, ZonedDateTime now) {
        Report r = build(ownerId, kind, now);
        String text = r.total() == 0 ? null : r.text();
        return new Preview(text, r.total(), text == null ? null : SolapiSmsSender.channelOf(text),
                text == null ? 0 : SolapiSmsSender.byteLength(text));
    }

    record Report(long total, String text) {
    }

    /** {@code now} 시점에 가장 최근에 끝난 구간의 리포트. */
    Report build(Long ownerId, LeadReportKind kind, ZonedDateTime now) {
        LeadReportKind.Window w = kind.latestWindow(now);
        List<Object[]> rows = leadRepository.countByOwnerBetweenGroupedByForm(ownerId,
                w.from().toInstant(), w.to().toInstant());
        Map<Long, Long> byForm = new HashMap<>();
        long total = 0;
        for (Object[] row : rows) {
            long c = ((Number) row[1]).longValue();
            byForm.put((Long) row[0], c);
            total += c;
        }
        if (total == 0) {
            return new Report(0, null);
        }
        LeadReportKind.Window prev = w.previousDay();
        long prevTotal = leadRepository.countByOwnerBetween(ownerId, prev.from().toInstant(), prev.to().toInstant());

        Map<Long, String> names = new HashMap<>();
        for (Form f : formRepository.findAllById(byForm.keySet())) {
            names.put(f.getId(), f.getName());
        }
        List<FormCount> counts = new ArrayList<>();
        byForm.forEach((id, c) -> counts.add(new FormCount(names.getOrDefault(id, "삭제된 리드폼"), c)));
        return new Report(total, format(kind, w, total, prevTotal, counts));
    }

    record FormCount(String name, long count) {
    }

    /** 본문 조립. 건수 많은 리드폼부터, 같으면 이름순. */
    static String format(LeadReportKind kind, LeadReportKind.Window w, long total, long prevTotal,
            List<FormCount> counts) {
        StringBuilder sb = new StringBuilder();
        if (kind == LeadReportKind.MORNING) {
            sb.append("[리드팟] 밤사이 리드 리포트\n");
            sb.append(DAY.format(w.from())).append(" 00:00~09:00\n\n");
            sb.append("총 ").append(total).append("건 (전날 같은 시간 ").append(prevTotal).append("건");
        } else {
            sb.append("[리드팟] 어제 하루 리드 리포트\n");
            sb.append(DAY.format(w.from())).append(" 00:00~24:00\n\n");
            sb.append("총 ").append(total).append("건 (그제 ").append(prevTotal).append("건");
        }
        sb.append(diff(total - prevTotal)).append(")\n");

        List<FormCount> sorted = new ArrayList<>(counts);
        sorted.sort(Comparator.comparingLong(FormCount::count).reversed().thenComparing(FormCount::name));
        int shown = Math.min(sorted.size(), MAX_FORM_LINES);
        for (int i = 0; i < shown; i++) {
            FormCount fc = sorted.get(i);
            sb.append("- ").append(shorten(fc.name())).append(": ").append(fc.count()).append("건\n");
        }
        if (sorted.size() > shown) {
            long rest = sorted.subList(shown, sorted.size()).stream().mapToLong(FormCount::count).sum();
            sb.append("- 외 ").append(sorted.size() - shown).append("개 리드폼: ").append(rest).append("건\n");
        }
        sb.append("\n자세히 보기: app.leadpot.kr");
        return sb.toString();
    }

    private static String diff(long d) {
        if (d > 0) {
            return ", ▲" + d;
        }
        if (d < 0) {
            return ", ▼" + (-d);
        }
        return ", 변동 없음";
    }

    private static String shorten(String name) {
        String n = name == null || name.isBlank() ? "(이름 없음)" : name.trim();
        return n.length() > MAX_FORM_NAME ? n.substring(0, MAX_FORM_NAME) + "…" : n;
    }

    // ---------- 발송 ----------

    /** 실행 결과(로그·테스트용). {@code sent} 는 발송 시도 건수(권한 부족으로 SKIPPED 된 것 포함). */
    public record Summary(int accounts, int sent, int empty) {
    }

    /**
     * 이 종류의 리포트를 켠 계정 전부에 보낸다. 한 계정 실패가 다른 계정을 막지 않는다.
     * 0건인 계정은 보내지 않는다(이력도 남기지 않는다 — 비용·소음이 없어야 하므로).
     */
    public Summary runAll(LeadReportKind kind, ZonedDateTime now) {
        List<LeadReportSettings> targets = kind == LeadReportKind.MORNING
                ? settingsRepository.findByMorningEnabledTrue()
                : settingsRepository.findByDailyEnabledTrue();
        int sent = 0;
        int empty = 0;
        for (LeadReportSettings s : targets) {
            try {
                if (sendOne(s, kind, now)) {
                    sent++;
                } else {
                    empty++;
                }
            } catch (RuntimeException e) {
                log.warn("[lead-report] {} 리포트 실패 owner={}: {}", kind, s.getOwnerId(), e.toString());
            }
        }
        return new Summary(targets.size(), sent, empty);
    }

    /** @return 발송을 시도했으면 true, 0건이라 건너뛰었으면 false */
    private boolean sendOne(LeadReportSettings s, LeadReportKind kind, ZonedDateTime now) {
        Optional<User> owner = userRepository.findById(s.getOwnerId());
        // 광고주 계정은 대상이 아니다(마케터 본인만). 설정 API 가 /api/** (USER) 라 들어올 일은 없지만 한 번 더 막는다.
        if (owner.isEmpty() || owner.get().isAdvertiser()) {
            return false;
        }
        Report r = build(s.getOwnerId(), kind, now);
        if (r.total() == 0) {
            return false;
        }
        String to = s.getPhone() != null && !s.getPhone().isBlank() ? s.getPhone() : owner.get().getPhone();
        // 권한·월 상한·번호 형식 검사와 이력 기록은 전부 SmsService 가 한다(막히면 SKIPPED 로 남는다).
        smsService.send(SmsService.SmsRequest.to(s.getOwnerId(), to, r.text(), MessageLog.TO_REPORT));
        return true;
    }
}
