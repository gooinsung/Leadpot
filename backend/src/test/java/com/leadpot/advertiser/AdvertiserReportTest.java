package com.leadpot.advertiser;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.advertiser.dto.AdvertiserReportResponse;
import com.leadpot.advertiser.dto.GrantUpdateRequest;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormType;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;

/**
 * A7 처리속도 리포트 검증. 접수→열람/상태 평균과 미확인율이 실제 타임스탬프로 정확히 계산되는지 본다.
 */
@SpringBootTest
@Transactional
class AdvertiserReportTest {

    @Autowired
    private AdvertiserLeadService leadService;
    @Autowired
    private AdvertiserService advertiserService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private LeadRepository leadRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private User marketer;
    private User advertiser;
    private Form form;

    @BeforeEach
    void setUp() {
        marketer = userRepository.save(marketer());
        advertiser = userRepository.save(User.advertiser("rep-a@test.local",
                passwordEncoder.encode("pw12345678"), "광고주", null, marketer.getId(), "회사"));
        form = formRepository.save(new Form(marketer.getId(), "리포트폼", FormType.BASIC));
        advertiserService.replaceGrants(marketer.getId(), advertiser.getId(),
                new GrantUpdateRequest(List.of(
                        new GrantUpdateRequest.Item(form.getId(), null, null, true, true, true))));
    }

    @Test
    @DisplayName("접수→열람/상태 평균과 미확인율을 정확히 집계한다")
    void aggregatesResponseTimes() {
        // A: 접수 120초 후 열람, 300초 후 상태변경(유효)
        Lead a = saveLead();
        a.markAdvertiserSeen(a.getCreatedAt().plusSeconds(120));
        a.changeStatus(com.leadpot.lead.LeadStatuses.VALID, null, a.getCreatedAt().plusSeconds(300));
        leadRepository.save(a);
        // B: 열람/상태 없음(미확인)
        saveLead();

        AdvertiserReportResponse r = leadService.report(advertiser.getId(), form.getId(), null, null);

        assertThat(r.total()).isEqualTo(2);
        assertThat(r.seen()).isEqualTo(1);
        assertThat(r.unseen()).isEqualTo(1);
        assertThat(r.unseenRate()).isEqualTo(0.5);
        assertThat(r.avgSecondsToSeen()).isEqualTo(120L);
        assertThat(r.avgSecondsToStatus()).isEqualTo(300L);
        // 전환 = 유효 상태. 2건 중 1건이 유효라 50%.
        assertThat(r.converted()).isEqualTo(1);
        assertThat(r.conversionRate()).isEqualTo(0.5);
        // 상태 분포: 유효 1, 신규 1(미변경은 NEW)
        Map<String, Integer> byCode = r.statusCounts().stream()
                .collect(java.util.stream.Collectors.toMap(
                        AdvertiserReportResponse.StatusCount::status,
                        AdvertiserReportResponse.StatusCount::count));
        assertThat(byCode.get(com.leadpot.lead.LeadStatuses.VALID)).isEqualTo(1);
        assertThat(byCode.get(com.leadpot.lead.LeadStatuses.NEW)).isEqualTo(1);
        // 고정 상태 4개가 모두 표에 들어간다(0 포함, 통합 축 V29).
        assertThat(r.statusCounts()).hasSize(com.leadpot.lead.LeadStatuses.FIXED_LABELS.size());
    }

    @Test
    @DisplayName("리드가 없으면 평균은 null, 미확인율·전환율 0 (0 나누기 금지)")
    void emptyIsSafe() {
        AdvertiserReportResponse r = leadService.report(advertiser.getId(), form.getId(), null, null);
        assertThat(r.total()).isZero();
        assertThat(r.avgSecondsToSeen()).isNull();
        assertThat(r.avgSecondsToStatus()).isNull();
        assertThat(r.unseenRate()).isEqualTo(0);
        assertThat(r.converted()).isZero();
        assertThat(r.conversionRate()).isEqualTo(0);
    }

    @Test
    @DisplayName("전환은 '유효'만 센다 — 무효·AS요청·신규는 전환이 아니다")
    void onlyValidCountsAsConversion() {
        // 유효 2건
        valid(saveLead());
        valid(saveLead());
        // 무효 1건 · AS요청 1건 · 신규 1건 → 전환에서 빠진다
        status(saveLead(), com.leadpot.lead.LeadStatuses.INVALID);
        status(saveLead(), com.leadpot.lead.LeadStatuses.AS_REQUESTED);
        saveLead();

        AdvertiserReportResponse r = leadService.report(advertiser.getId(), form.getId(), null, null);

        assertThat(r.total()).isEqualTo(5);
        assertThat(r.converted()).isEqualTo(2);
        assertThat(r.conversionRate()).isEqualTo(0.4);
    }

    private void valid(Lead l) {
        status(l, com.leadpot.lead.LeadStatuses.VALID);
    }

    private void status(Lead l, String status) {
        l.changeStatus(status, null, l.getCreatedAt().plusSeconds(60));
        leadRepository.save(l);
    }

    @Test
    @DisplayName("마케터 리포트는 광고주의 여러 폼 리드를 합산한다")
    void marketerReportAggregatesAcrossForms() {
        // form 에 1건, 두 번째 폼에 2건 → 총 3건 합산
        saveLead();
        Form form2 = formRepository.save(new Form(marketer.getId(), "리포트폼2", FormType.BASIC));
        saveLeadOn(form2);
        saveLeadOn(form2);
        advertiserService.replaceGrants(marketer.getId(), advertiser.getId(),
                new GrantUpdateRequest(List.of(
                        new GrantUpdateRequest.Item(form.getId(), null, null, true, true, true),
                        new GrantUpdateRequest.Item(form2.getId(), null, null, true, true, true))));

        AdvertiserReportResponse r =
                advertiserService.responseTimeReport(marketer.getId(), advertiser.getId(), null, null);
        assertThat(r.total()).isEqualTo(3);
        assertThat(r.formId()).isNull(); // 합산이라 특정 폼이 아님
    }

    @Test
    @DisplayName("다른 마케터의 광고주 리포트는 404")
    void otherMarketerCannotReport() {
        User other = userRepository.save(new User("rep-m2@test.local",
                passwordEncoder.encode("pw12345678"), "마케터2", null));
        other.setSubdomain("rep-m2");
        userRepository.save(other);
        assertThatThrownBy(() -> advertiserService.responseTimeReport(other.getId(), advertiser.getId(), null, null))
                .isInstanceOf(NotFoundException.class);
    }

    private User marketer() {
        User u = new User("rep-m@test.local", passwordEncoder.encode("pw12345678"), "마케터", null);
        u.setSubdomain("rep-m");
        return u;
    }

    private Lead saveLead() {
        return saveLeadOn(form);
    }

    private Lead saveLeadOn(Form f) {
        Lead l = new Lead();
        l.setFormId(f.getId());
        l.setAnswers(List.of(Map.of("label", "이름", "value", "홍길동")));
        return leadRepository.save(l);
    }
}
