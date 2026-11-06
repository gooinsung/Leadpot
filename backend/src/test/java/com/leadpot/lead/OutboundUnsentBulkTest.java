package com.leadpot.lead;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormType;
import com.leadpot.lead.dto.OutboundUnsentResponse;

/**
 * 외부 API 전달 '미전송 일괄 전송'(2026-11-06) — 연동을 켜기 전에 들어온 리드만 골라 전송 대기로 넣는지.
 * 테스트 트랜잭션은 커밋되지 않으므로 실제 외부 호출(커밋 후 비동기)은 일어나지 않는다.
 */
@SpringBootTest
@Transactional
class OutboundUnsentBulkTest {

    @Autowired
    private LeadService leadService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private LeadRepository leadRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private User owner;
    private Form form;
    private Lead unsent1;
    private Lead unsent2;

    @BeforeEach
    void setUp() {
        User u = new User("ob-bulk@test.local", passwordEncoder.encode("pw12345678"), "마케터", null);
        u.setSubdomain("ob-bulk");
        owner = userRepository.save(u);
        form = new Form(owner.getId(), "외부전송 폼", FormType.BASIC);
        Map<String, Object> cfg = new HashMap<>();
        cfg.put("outboundWebhookEnabled", true);
        cfg.put("outboundWebhookUrl", "http://127.0.0.1:9/hook");
        cfg.put("outboundWebhookMethod", "GET");
        form.setSettingsConfig(cfg);
        form = formRepository.save(form);

        unsent1 = saveLead(null);
        unsent2 = saveLead(null);
        saveLead("SUCCESS");
        saveLead("FAILED");
        Lead trashed = saveLead(null);
        trashed.setDeletedAt(Instant.now());
        leadRepository.save(trashed);
    }

    @Test
    @DisplayName("미전송 = 전송 시도가 없는 활성 리드만(성공·실패·휴지통 제외)")
    void countsOnlyNeverSent() {
        OutboundUnsentResponse r = leadService.countOutboundUnsent(owner.getId(), form.getId(), null, null);
        assertThat(r.total()).isEqualTo(2);
        assertThat(r.queued()).isZero();
    }

    @Test
    @DisplayName("일괄 전송하면 대상이 PENDING 으로 찍혀 다시 눌러도 중복으로 잡히지 않는다")
    void sendMarksPendingAndIsIdempotent() {
        OutboundUnsentResponse r = leadService.sendOutboundUnsent(owner.getId(), form.getId(), null, null);
        assertThat(r.queued()).isEqualTo(2);
        assertThat(r.remaining()).isZero();
        assertThat(List.of(unsent1, unsent2))
                .allSatisfy(l -> assertThat(leadRepository.findById(l.getId()).orElseThrow().getOutboundWebhookStatus())
                        .isEqualTo("PENDING"));

        OutboundUnsentResponse again = leadService.sendOutboundUnsent(owner.getId(), form.getId(), null, null);
        assertThat(again.queued()).isZero();
    }

    @Test
    @DisplayName("기간 필터: 범위 밖이면 대상이 없다")
    void dateRangeFilters() {
        String tomorrow = LocalDate.now(ZoneId.of("Asia/Seoul")).plusDays(1).toString();
        String today = LocalDate.now(ZoneId.of("Asia/Seoul")).toString();
        assertThat(leadService.countOutboundUnsent(owner.getId(), form.getId(), tomorrow, null).total()).isZero();
        assertThat(leadService.countOutboundUnsent(owner.getId(), form.getId(), today, today).total()).isEqualTo(2);
        assertThatThrownBy(() -> leadService.countOutboundUnsent(owner.getId(), form.getId(), tomorrow, today))
                .isInstanceOf(InvalidSubmissionException.class);
    }

    @Test
    @DisplayName("연동이 꺼져 있으면 일괄 전송을 거부한다")
    void rejectsWhenDisabled() {
        Map<String, Object> cfg = new HashMap<>(form.getSettingsConfig());
        cfg.put("outboundWebhookEnabled", false);
        form.setSettingsConfig(cfg);
        formRepository.save(form);
        assertThatThrownBy(() -> leadService.sendOutboundUnsent(owner.getId(), form.getId(), null, null))
                .isInstanceOf(InvalidSubmissionException.class);
    }

    private Lead saveLead(String outboundStatus) {
        Lead l = new Lead();
        l.setFormId(form.getId());
        l.setAnswers(List.of(Map.of("label", "이름", "value", "홍길동", "varKey", "name")));
        if (outboundStatus != null) {
            l.setOutboundWebhookResult(outboundStatus, 200, "ok", Instant.now());
        }
        return leadRepository.save(l);
    }
}
