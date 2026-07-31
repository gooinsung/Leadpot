package com.leadpot.advertiser;

import static org.assertj.core.api.Assertions.assertThat;

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
        // A: 접수 120초 후 열람, 300초 후 상태변경
        Lead a = saveLead();
        a.markAdvertiserSeen(a.getCreatedAt().plusSeconds(120));
        a.changeAdvertiserStatus("CALLED", a.getCreatedAt().plusSeconds(300));
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
        // 상태 분포: CALLED 1, NEW 1(미확인은 NEW 로 집계)
        Map<String, Integer> byCode = r.statusCounts().stream()
                .collect(java.util.stream.Collectors.toMap(
                        AdvertiserReportResponse.StatusCount::status,
                        AdvertiserReportResponse.StatusCount::count));
        assertThat(byCode.get("CALLED")).isEqualTo(1);
        assertThat(byCode.get("NEW")).isEqualTo(1);
        // 6개 상태가 모두 표에 들어간다(0 포함).
        assertThat(r.statusCounts()).hasSize(AdvertiserLeadStatus.LABELS.size());
    }

    @Test
    @DisplayName("리드가 없으면 평균은 null, 미확인율 0")
    void emptyIsSafe() {
        AdvertiserReportResponse r = leadService.report(advertiser.getId(), form.getId(), null, null);
        assertThat(r.total()).isZero();
        assertThat(r.avgSecondsToSeen()).isNull();
        assertThat(r.avgSecondsToStatus()).isNull();
        assertThat(r.unseenRate()).isEqualTo(0);
    }

    private User marketer() {
        User u = new User("rep-m@test.local", passwordEncoder.encode("pw12345678"), "마케터", null);
        u.setSubdomain("rep-m");
        return u;
    }

    private Lead saveLead() {
        Lead l = new Lead();
        l.setFormId(form.getId());
        l.setAnswers(List.of(Map.of("label", "이름", "value", "홍길동")));
        return leadRepository.save(l);
    }
}
