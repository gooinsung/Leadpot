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

import com.leadpot.advertiser.dto.GrantUpdateRequest;
import com.leadpot.advertiser.dto.LeadAdvertiserActivityResponse;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormType;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;
import com.leadpot.lead.LeadStatuses;

/**
 * V33 — 마케터가 "이 리드를 광고주가 보기는 했나"를 확인하는 화면의 근거 데이터 검증.
 * <p>
 * 감사 로그는 별도 트랜잭션({@link AdvertiserAuditWriter})으로 커밋되므로 이 테스트가 롤백돼도 남는다.
 * FK 가 없는 append-only 표라 잔여 행은 무해하다(리드 id 로만 조회한다).
 */
@SpringBootTest
@Transactional
class AdvertiserLeadActivityTest {

    @Autowired
    private AdvertiserLeadService leadService;
    @Autowired
    private AdvertiserLeadActivityService activityService;
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
    private Lead lead;

    @BeforeEach
    void setUp() {
        marketer = saveMarketer("act-m@test.local", "act-m");
        advertiser = userRepository.save(User.advertiser("act-a@test.local",
                passwordEncoder.encode("pw12345678"), "광고주", null, marketer.getId(), "회사"));
        form = formRepository.save(new Form(marketer.getId(), "활동추적폼", FormType.BASIC));
        lead = saveLead(form);

        advertiserService.replaceGrants(marketer.getId(), advertiser.getId(),
                new GrantUpdateRequest(List.of(
                        new GrantUpdateRequest.Item(form.getId(), null, null, true, true, true))));
    }

    private User saveMarketer(String email, String subdomain) {
        User u = new User(email, passwordEncoder.encode("pw12345678"), "마케터", null);
        u.setSubdomain(subdomain);
        return userRepository.save(u);
    }

    private Lead saveLead(Form f) {
        Lead l = new Lead();
        l.setFormId(f.getId());
        l.setAnswers(List.of(Map.of("label", "이름", "value", "홍길동")));
        return leadRepository.save(l);
    }

    @Test
    @DisplayName("광고주가 열기 전에는 '열람 기록 없음'이다")
    void notViewedBeforeAdvertiserOpensIt() {
        LeadAdvertiserActivityResponse r = activityService.of(marketer.getId(), lead.getId());

        assertThat(r.level()).isEqualTo(LeadAdvertiserActivityResponse.LEVEL_NOT_VIEWED);
        assertThat(r.viewCount()).isZero();
        assertThat(r.firstViewedAt()).isNull();
        assertThat(r.advertiserId()).isEqualTo(advertiser.getId());
        assertThat(r.advertiserName()).isEqualTo("회사");
    }

    @Test
    @DisplayName("광고주가 상세를 열면 열람으로 잡히고 이력이 남는다")
    void viewIsRecordedWithHistory() {
        leadService.lead(advertiser.getId(), lead.getId(), "1.1.1.1");

        LeadAdvertiserActivityResponse r = activityService.of(marketer.getId(), lead.getId());

        assertThat(r.level()).isEqualTo(LeadAdvertiserActivityResponse.LEVEL_VIEWED);
        assertThat(r.viewCount()).isEqualTo(1);
        assertThat(r.firstViewedAt()).isNotNull();
        assertThat(r.acted()).isFalse();
        assertThat(r.entries()).anyMatch(e -> "VIEW_LEAD".equals(e.action()) && "최초 열람".equals(e.detail()));
    }

    @Test
    @DisplayName("30분 안에 다시 열면 이력이 중복으로 쌓이지 않는다")
    void reopenWithinWindowIsNotLoggedTwice() {
        leadService.lead(advertiser.getId(), lead.getId(), "1.1.1.1");
        leadService.lead(advertiser.getId(), lead.getId(), "1.1.1.1");
        leadService.lead(advertiser.getId(), lead.getId(), "1.1.1.1");

        LeadAdvertiserActivityResponse r = activityService.of(marketer.getId(), lead.getId());

        assertThat(r.viewCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("상태 변경까지 했으면 '열람 + 처리함'으로 올라간다")
    void statusChangeRaisesLevelToActed() {
        leadService.lead(advertiser.getId(), lead.getId(), "1.1.1.1");
        leadService.updateStatus(advertiser.getId(), lead.getId(), LeadStatuses.VALID, null, "1.1.1.1");

        LeadAdvertiserActivityResponse r = activityService.of(marketer.getId(), lead.getId());

        assertThat(r.acted()).isTrue();
        assertThat(r.level()).isEqualTo(LeadAdvertiserActivityResponse.LEVEL_ACTED);
    }

    @Test
    @DisplayName("마케터 대리 열람은 광고주 열람으로 잡히지 않는다")
    void impersonatedReadDoesNotCountAsAdvertiserView() {
        leadService.leadReadOnly(advertiser.getId(), lead.getId());

        LeadAdvertiserActivityResponse r = activityService.of(marketer.getId(), lead.getId());

        assertThat(r.level()).isEqualTo(LeadAdvertiserActivityResponse.LEVEL_NOT_VIEWED);
        assertThat(r.entries()).isEmpty();
    }

    @Test
    @DisplayName("남의 리드는 조회할 수 없다(404)")
    void otherMarketerCannotRead() {
        User stranger = saveMarketer("act-x@test.local", "act-x");

        assertThatThrownBy(() -> activityService.of(stranger.getId(), lead.getId()))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("광고주가 배정되지 않은 리드폼이면 섹션을 그리지 않도록 NO_ADVERTISER 를 준다")
    void noAdvertiserWhenFormIsNotGranted() {
        Form ungranted = formRepository.save(new Form(marketer.getId(), "미배정폼", FormType.BASIC));
        Lead orphan = saveLead(ungranted);

        LeadAdvertiserActivityResponse r = activityService.of(marketer.getId(), orphan.getId());

        assertThat(r.level()).isEqualTo(LeadAdvertiserActivityResponse.LEVEL_NONE);
        assertThat(r.advertiserId()).isNull();
    }
}
