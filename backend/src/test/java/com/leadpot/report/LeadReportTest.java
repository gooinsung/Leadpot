package com.leadpot.report;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormType;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;
import com.leadpot.sms.MessageLog;
import com.leadpot.sms.MessageLogRepository;

import jakarta.persistence.EntityManager;

/**
 * 리드 리포트 문자(V47) — 구간 계산·본문·발송 대상·권한 검증.
 *
 * <p>테스트 환경엔 솔라피 자격증명이 없어 실제로 나가지 않고 SKIPPED 이력만 남는다 — 그 이력의
 * 본문·수신자 유형으로 "무엇을 누구에게 보내려 했는가"를 확인한다.
 */
@SpringBootTest
@Transactional
class LeadReportTest {

    @Autowired
    private LeadReportService service;
    @Autowired
    private LeadReportSettingsRepository settingsRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private LeadRepository leadRepository;
    @Autowired
    private MessageLogRepository logRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private EntityManager em;

    /** 2026-11-01(일) 09:00:30 KST — 아침 리포트 실행 시각. */
    private static final ZonedDateTime MORNING_RUN = ZonedDateTime.parse("2026-11-01T09:00:30+09:00[Asia/Seoul]");
    /** 2026-11-01(일) 00:00:30 KST — 하루 리포트 실행 시각(어제 10/31 집계). */
    private static final ZonedDateTime DAILY_RUN = ZonedDateTime.parse("2026-11-01T00:00:30+09:00[Asia/Seoul]");

    @Test
    @DisplayName("구간: 아침=오늘 00~09시(09시 전이면 어제), 하루=어제 00~24시")
    void windows() {
        LeadReportKind.Window m = LeadReportKind.MORNING.latestWindow(MORNING_RUN);
        assertThat(m.from()).isEqualTo(ZonedDateTime.parse("2026-11-01T00:00+09:00[Asia/Seoul]"));
        assertThat(m.to()).isEqualTo(ZonedDateTime.parse("2026-11-01T09:00+09:00[Asia/Seoul]"));

        LeadReportKind.Window early = LeadReportKind.MORNING.latestWindow(MORNING_RUN.withHour(8));
        assertThat(early.from().getDayOfMonth()).isEqualTo(31);

        LeadReportKind.Window d = LeadReportKind.DAILY.latestWindow(DAILY_RUN);
        assertThat(d.from()).isEqualTo(ZonedDateTime.parse("2026-10-31T00:00+09:00[Asia/Seoul]"));
        assertThat(d.to()).isEqualTo(ZonedDateTime.parse("2026-11-01T00:00+09:00[Asia/Seoul]"));
        // UTC 서버에서 돌아도 서울 기준으로 자른다
        assertThat(LeadReportKind.DAILY.latestWindow(DAILY_RUN.withZoneSameInstant(java.time.ZoneOffset.UTC)))
                .isEqualTo(d);
    }

    @Test
    @DisplayName("아침 리포트: 구간 안 리드만 리드폼별로 세고, 전날 같은 시간과 비교해 마케터에게 보낸다")
    void morningReport() {
        User owner = owner("morning", true);
        Form lease = form(owner, "자동차리스 상담");
        Form rent = form(owner, "장기렌트");
        lead(lease, "2026-11-01T01:00:00+09:00");
        lead(lease, "2026-11-01T08:59:00+09:00");
        lead(rent, "2026-11-01T03:00:00+09:00");
        lead(rent, "2026-11-01T09:00:00+09:00"); // 09:00 정각은 다음 구간
        lead(lease, "2026-10-31T23:59:00+09:00"); // 어제 밤 — 제외
        lead(lease, "2026-10-31T05:00:00+09:00"); // 전날 같은 시간대(비교용)
        enable(owner, true, false, null);

        LeadReportService.Summary s = run(LeadReportKind.MORNING, MORNING_RUN);

        assertThat(s.sent()).isEqualTo(1);
        MessageLog log = onlyLog(owner);
        assertThat(log.getRecipientType()).isEqualTo(MessageLog.TO_REPORT);
        assertThat(log.getRecipient()).isEqualTo("0101234····"); // 계정 연락처(마스킹)
        assertThat(log.getRenderedBody())
                .startsWith("[리드팟] 밤사이 리드 리포트\n11/1(일) 00:00~09:00\n\n")
                .contains("총 3건 (전날 같은 시간 1건, ▲2)")
                .contains("- 자동차리스 상담: 2건\n- 장기렌트: 1건\n")
                .doesNotContain("홍길동"); // 개인정보는 넣지 않는다
    }

    @Test
    @DisplayName("하루 리포트: 어제 00~24시, 받을 번호를 지정하면 그 번호로")
    void dailyReport() {
        User owner = owner("daily", true);
        Form f = form(owner, "리스폼");
        lead(f, "2026-10-31T00:00:00+09:00");
        lead(f, "2026-10-31T23:59:59+09:00");
        lead(f, "2026-10-30T12:00:00+09:00");
        lead(f, "2026-10-30T13:00:00+09:00");
        lead(f, "2026-10-30T14:00:00+09:00");
        enable(owner, false, true, "010-9999-8888");

        run(LeadReportKind.DAILY, DAILY_RUN);

        MessageLog log = onlyLog(owner);
        assertThat(log.getRecipient()).isEqualTo("0109999····");
        assertThat(log.getRenderedBody())
                .startsWith("[리드팟] 어제 하루 리드 리포트\n10/31(토) 00:00~24:00\n\n")
                .contains("총 2건 (그제 3건, ▼1)");
        // 아침 리포트는 꺼져 있으니 안 나간다
        assertThat(run(LeadReportKind.MORNING, MORNING_RUN).accounts()).isZero();
    }

    @Test
    @DisplayName("0건이면 보내지 않고 이력도 남기지 않는다")
    void skipsEmpty() {
        User owner = owner("empty", true);
        form(owner, "빈폼");
        enable(owner, true, true, null);

        LeadReportService.Summary s = run(LeadReportKind.MORNING, MORNING_RUN);

        assertThat(s.empty()).isEqualTo(1);
        assertThat(logs(owner)).isEmpty();
        assertThat(service.preview(owner.getId(), LeadReportKind.MORNING, MORNING_RUN).text()).isNull();
    }

    @Test
    @DisplayName("문자 권한(LMS)이 없으면 켤 수 없다 — 끄는 건 된다")
    void requiresPermissionToEnable() {
        User owner = owner("noperm", false);
        assertThatThrownBy(() -> service.update(owner.getId(), true, false, null))
                .isInstanceOf(InvalidSubmissionException.class)
                .hasMessageContaining("리포트 문자를 켤 수 없습니다");
        assertThat(service.update(owner.getId(), false, false, null).morningEnabled()).isFalse();
        assertThat(service.get(owner.getId()).denyReason()).isNotNull();
    }

    @Test
    @DisplayName("받을 번호 형식이 틀리면 저장하지 않는다")
    void rejectsBadPhone() {
        User owner = owner("badphone", true);
        assertThatThrownBy(() -> service.update(owner.getId(), true, false, "123"))
                .isInstanceOf(InvalidSubmissionException.class);
        assertThat(service.update(owner.getId(), true, false, "010-1111-2222").phone()).isEqualTo("01011112222");
    }

    @Test
    @DisplayName("리드폼이 많으면 15개까지만 적고 나머지는 한 줄로 묶는다")
    void collapsesManyForms() {
        LeadReportKind.Window w = LeadReportKind.DAILY.latestWindow(DAILY_RUN);
        List<LeadReportService.FormCount> counts = new java.util.ArrayList<>();
        for (int i = 0; i < 18; i++) {
            counts.add(new LeadReportService.FormCount("폼" + (char) ('A' + i), 1));
        }
        String text = LeadReportService.format(LeadReportKind.DAILY, w, 18, 18, counts);
        assertThat(text).contains("변동 없음").contains("- 외 3개 리드폼: 3건");
        assertThat(text.lines().filter(l -> l.startsWith("- 폼")).count()).isEqualTo(15);
    }

    // ---------- 픽스처 ----------

    private User owner(String key, boolean smsAllowed) {
        User u = new User("report-" + key + "@test.local", passwordEncoder.encode("pw12345678"), "마케터",
                "010-1234-5678");
        u.setSubdomain("report-" + key);
        if (smsAllowed) {
            u.setSmsEnabled(true);
            u.setSmsAllowedChannels("SMS,LMS");
            u.setSmsMonthlyLimit(-1);
        }
        return userRepository.save(u);
    }

    private Form form(User owner, String name) {
        return formRepository.save(new Form(owner.getId(), name, FormType.BASIC));
    }

    private void lead(Form form, String at) {
        Lead l = new Lead();
        l.setFormId(form.getId());
        l.setAnswers(List.of(Map.of("label", "이름", "value", "홍길동")));
        l = leadRepository.save(l);
        em.flush();
        em.createQuery("update Lead l set l.createdAt = :at where l.id = :id")
                .setParameter("at", ZonedDateTime.parse(at).toInstant())
                .setParameter("id", l.getId())
                .executeUpdate();
        em.clear();
    }

    private void enable(User owner, boolean morning, boolean daily, String phone) {
        LeadReportSettings s = new LeadReportSettings(owner.getId());
        s.setMorningEnabled(morning);
        s.setDailyEnabled(daily);
        s.setPhone(phone == null ? null : phone.replaceAll("[^0-9]", ""));
        settingsRepository.save(s);
        em.flush();
    }

    private LeadReportService.Summary run(LeadReportKind kind, ZonedDateTime now) {
        em.flush();
        em.clear();
        return service.runAll(kind, now);
    }

    private List<MessageLog> logs(User owner) {
        return logRepository.findByOwnerIdOrderByCreatedAtDesc(owner.getId(), PageRequest.of(0, 10));
    }

    private MessageLog onlyLog(User owner) {
        List<MessageLog> logs = logs(owner);
        assertThat(logs).hasSize(1);
        return logs.get(0);
    }
}
