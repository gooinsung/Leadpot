package com.leadpot.lead;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.form.AutoApproveSettings;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormType;

import jakarta.persistence.EntityManager;

/**
 * 자동 승인 기간 검증 — 유예 기간이 지난 리드를 <b>유효</b>로 확정하고 이력을 남긴다(통합 축 V29).
 *
 * <p>가장 중요한 검증은 <b>소급 적용을 하지 않는다</b>는 것이다({@code doesNotApplyRetroactively}).
 * 그게 깨지면 기능을 켜는 순간 과거 리드가 대량으로 유효 처리(=과금)되고 되돌릴 수 없다.
 */
@SpringBootTest
@Transactional
class LeadAutoApproveTest {

    @Autowired
    private LeadAutoApproveRunner runner;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private LeadRepository leadRepository;
    @Autowired
    private LeadNoteRepository leadNoteRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private EntityManager em;

    private static final Instant NOW = Instant.parse("2026-08-06T00:00:00Z");

    @Test
    @DisplayName("유예 기간이 지난 신규·커스텀 리드를 유효로 확정하고 자동 메모를 남긴다")
    void approvesExpiredLeads() {
        Form form = form(7, NOW.minus(30, ChronoUnit.DAYS));
        Lead old = lead(form, LeadStatuses.NEW, NOW.minus(10, ChronoUnit.DAYS));
        Lead inCustom = lead(form, LeadStatuses.CUSTOM, NOW.minus(8, ChronoUnit.DAYS));
        Lead fresh = lead(form, LeadStatuses.NEW, NOW.minus(3, ChronoUnit.DAYS));

        LeadAutoApproveRunner.Summary s = run();

        assertThat(s.approved()).isEqualTo(2);
        assertThat(status(old)).isEqualTo(LeadStatuses.VALID);
        assertThat(status(inCustom)).isEqualTo(LeadStatuses.VALID);
        assertThat(status(fresh)).isEqualTo(LeadStatuses.NEW); // 아직 기간 미달

        List<LeadNote> notes = leadNoteRepository.findByLeadIdOrderByCreatedAtAsc(old.getId());
        assertThat(notes).hasSize(1);
        assertThat(notes.get(0).getKind()).isEqualTo(LeadNote.KIND_SYSTEM);
        assertThat(notes.get(0).getBody())
                .isEqualTo("설정에 따른 자동 승인 — 접수 후 7일 경과: 신규 → 유효");
        // 공유 축(V29) — 유효 확정은 정산 근거라 광고주도 이력을 본다.
        assertThat(notes.get(0).isSharedWithAdvertiser()).isTrue();
    }

    @Test
    @DisplayName("⚠️ 소급 적용하지 않는다 — 설정을 켠 시각 이전에 접수된 리드는 건드리지 않는다")
    void doesNotApplyRetroactively() {
        // 30일 전부터 리드를 받아온 리드폼에 '오늘' 자동 승인(7일)을 켠 상황.
        Form form = form(7, NOW.minus(1, ChronoUnit.HOURS));
        Lead legacy = lead(form, LeadStatuses.NEW, NOW.minus(30, ChronoUnit.DAYS));

        assertThat(run().approved()).isZero();
        assertThat(status(legacy)).isEqualTo(LeadStatuses.NEW);
        assertThat(leadNoteRepository.findByLeadIdOrderByCreatedAtAsc(legacy.getId())).isEmpty();
    }

    @Test
    @DisplayName("무효·AS요청·이미 유효·휴지통 리드는 건드리지 않는다")
    void skipsNonTargetLeads() {
        Form form = form(7, NOW.minus(30, ChronoUnit.DAYS));
        Lead invalid = lead(form, LeadStatuses.INVALID, NOW.minus(10, ChronoUnit.DAYS));
        Lead asRequested = lead(form, LeadStatuses.AS_REQUESTED, NOW.minus(10, ChronoUnit.DAYS));
        Lead valid = lead(form, LeadStatuses.VALID, NOW.minus(10, ChronoUnit.DAYS));
        Lead trashed = lead(form, LeadStatuses.NEW, NOW.minus(10, ChronoUnit.DAYS));
        // lead() 가 컨텍스트를 비워 detached 상태다 — save(merge) 대신 JPQL 로 직접 바꾼다.
        em.createQuery("update Lead l set l.deletedAt = :at where l.id = :id")
                .setParameter("at", NOW.minus(9, ChronoUnit.DAYS))
                .setParameter("id", trashed.getId())
                .executeUpdate();
        em.clear();

        assertThat(run().approved()).isZero();
        assertThat(status(invalid)).isEqualTo(LeadStatuses.INVALID);
        assertThat(status(asRequested)).isEqualTo(LeadStatuses.AS_REQUESTED);
        assertThat(status(valid)).isEqualTo(LeadStatuses.VALID);
        assertThat(status(trashed)).isEqualTo(LeadStatuses.NEW);
    }

    @Test
    @DisplayName("설정이 꺼진 리드폼은 대상이 아니다")
    void skipsDisabledForm() {
        Form off = formRepository.save(new Form(owner().getId(), "끔", FormType.BASIC));
        Lead l = lead(off, LeadStatuses.NEW, NOW.minus(100, ChronoUnit.DAYS));

        assertThat(run().forms()).isZero();
        assertThat(status(l)).isEqualTo(LeadStatuses.NEW);
    }

    @Test
    @DisplayName("기준 시각(since)은 서버가 찍는다 — 켠 채로 저장하면 유지, 껐다 켜면 새로 시작")
    void stampsSinceOnServer() {
        Instant t1 = Instant.parse("2026-01-01T00:00:00Z");
        Instant t2 = Instant.parse("2026-06-01T00:00:00Z");

        // 새로 켬 → t1 이 찍힌다. 클라이언트가 보낸 과거 since 는 무시된다.
        Map<String, Object> incoming = new LinkedHashMap<>();
        incoming.put(AutoApproveSettings.KEY_ENABLED, true);
        incoming.put(AutoApproveSettings.KEY_DAYS, 7);
        incoming.put(AutoApproveSettings.KEY_SINCE, "2020-01-01T00:00:00Z");
        Map<String, Object> on = AutoApproveSettings.stamp(null, incoming, t1);
        assertThat(on.get(AutoApproveSettings.KEY_SINCE)).isEqualTo(t1.toString());

        // 켠 채로 일수만 변경 → 기준 시각 유지
        Map<String, Object> changed = new LinkedHashMap<>(on);
        changed.put(AutoApproveSettings.KEY_DAYS, 14);
        Map<String, Object> kept = AutoApproveSettings.stamp(on, changed, t2);
        assertThat(kept.get(AutoApproveSettings.KEY_SINCE)).isEqualTo(t1.toString());
        assertThat(AutoApproveSettings.from(kept).days()).isEqualTo(14);

        // 껐다 다시 켬 → 새 기준 시각(그 사이 쌓인 리드가 소급 적용되지 않는다)
        Map<String, Object> offMap = new LinkedHashMap<>(kept);
        offMap.put(AutoApproveSettings.KEY_ENABLED, false);
        Map<String, Object> turnedOff = AutoApproveSettings.stamp(kept, offMap, t2);
        assertThat(turnedOff).doesNotContainKey(AutoApproveSettings.KEY_SINCE);

        Map<String, Object> again = new LinkedHashMap<>(turnedOff);
        again.put(AutoApproveSettings.KEY_ENABLED, true);
        again.put(AutoApproveSettings.KEY_DAYS, 7);
        assertThat(AutoApproveSettings.stamp(turnedOff, again, t2).get(AutoApproveSettings.KEY_SINCE))
                .isEqualTo(t2.toString());
    }

    @Test
    @DisplayName("일수가 1 미만이면 예외 없이 꺼진다(저장 자체를 막지 않는다)")
    void zeroDaysIsForcedOff() {
        Map<String, Object> incoming = new LinkedHashMap<>();
        incoming.put(AutoApproveSettings.KEY_ENABLED, true);
        incoming.put(AutoApproveSettings.KEY_DAYS, 0);
        Map<String, Object> result = AutoApproveSettings.stamp(null, incoming, NOW);

        assertThat(result.get(AutoApproveSettings.KEY_ENABLED)).isEqualTo(false);
        assertThat(result).doesNotContainKey(AutoApproveSettings.KEY_SINCE);
        assertThat(AutoApproveSettings.from(result).active()).isFalse();
    }

    // ---------- 픽스처 ----------

    private User cachedOwner;

    private User owner() {
        if (cachedOwner == null) {
            User u = new User("auto-approve@test.local", passwordEncoder.encode("pw12345678"), "마케터", null);
            u.setSubdomain("auto-approve");
            cachedOwner = userRepository.save(u);
        }
        return cachedOwner;
    }

    /** 자동 승인이 켜진 리드폼. {@code since} 는 stamp 를 거치지 않고 직접 심는다(시각 고정). */
    private Form form(int days, Instant since) {
        Form f = new Form(owner().getId(), "자동승인폼", FormType.BASIC);
        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put(AutoApproveSettings.KEY_ENABLED, true);
        settings.put(AutoApproveSettings.KEY_DAYS, days);
        settings.put(AutoApproveSettings.KEY_SINCE, since.toString());
        f.setSettingsConfig(settings);
        return formRepository.save(f);
    }

    /**
     * 접수 시각을 지정한 리드. {@code createdAt} 은 {@code @CreationTimestamp} 라 엔티티로는
     * 못 바꾸므로 JPQL 로 직접 갱신한 뒤 <b>영속성 컨텍스트를 비운다</b> —
     * 비우지 않으면 뒤이은 조회가 옛 값을 가진 관리 엔티티를 그대로 돌려준다.
     */
    private Lead lead(Form form, String status, Instant createdAt) {
        Lead l = new Lead(); // 기본 NEW
        l.setFormId(form.getId());
        if (!LeadStatuses.NEW.equals(status)) {
            // CUSTOM 은 정의를 안 만들고 임의 id 를 심는다 — H2 는 FK 가 없어 통과하고,
            // 러너 판정은 status 값만 보므로 충분하다.
            l.changeStatus(status, LeadStatuses.CUSTOM.equals(status) ? 999L : null, NOW);
        }
        l.setAnswers(List.of(Map.of("label", "이름", "value", "홍길동")));
        l = leadRepository.save(l);
        em.flush();
        em.createQuery("update Lead l set l.createdAt = :at where l.id = :id")
                .setParameter("at", createdAt)
                .setParameter("id", l.getId())
                .executeUpdate();
        em.clear();
        return l;
    }

    private LeadAutoApproveRunner.Summary run() {
        em.flush();
        em.clear();
        return runner.runAll(NOW);
    }

    private String status(Lead lead) {
        em.flush();
        return leadRepository.findById(lead.getId()).orElseThrow().getStatus();
    }
}
