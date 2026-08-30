package com.leadpot.lead;

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

import com.leadpot.advertiser.AdvertiserService;
import com.leadpot.advertiser.dto.GrantUpdateRequest;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormType;
import com.leadpot.lead.dto.LeadAsRequestResponse;

/**
 * 유효 확정 잠금 + AS 요청 플로우(V29/V30) 검증 — 정산(V31) 제거 이전에는 이 규칙이
 * {@code AdvertiserBillingTest} 에 과금 검증과 섞여 있었다. 정산을 걷어내면서 분리했다:
 * 이 규칙 자체는 과금과 무관하게(2026-08-20 사용자 확정) 그대로 유지된다.
 */
@SpringBootTest
@Transactional
class LeadStatusLockAndAsFlowTest {

    @Autowired
    private LeadStatusService statusService;
    @Autowired
    private LeadAsRequestService asService;
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
        marketer = userRepository.save(newMarketer());
        advertiser = userRepository.save(User.advertiser("lock-a@test.local",
                passwordEncoder.encode("pw12345678"), "광고주", null, marketer.getId(), "회사"));
        form = formRepository.save(new Form(marketer.getId(), "잠금폼", FormType.BASIC));
        advertiserService.replaceGrants(marketer.getId(), advertiser.getId(),
                new GrantUpdateRequest(List.of(
                        new GrantUpdateRequest.Item(form.getId(), null, null, true, true, true))));
    }

    private User newMarketer() {
        User u = new User("lock-m@test.local", passwordEncoder.encode("pw12345678"), "마케터", null);
        u.setSubdomain("lock-m");
        return u;
    }

    private Lead lead() {
        Lead l = new Lead();
        l.setFormId(form.getId());
        l.setAnswers(List.of(Map.of("label", "이름", "value", "홍길동")));
        return leadRepository.save(l);
    }

    @Test
    @DisplayName("AS 인정 → 무효 / 거부 → 유효 확정 유지")
    void asFlowAcceptInvalidatesRejectKeepsValid() {
        Lead accepted = lead();
        statusService.changeByMarketer(marketer.getId(), accepted, LeadStatuses.VALID, null);
        asService.request(advertiser.getId(), accepted, "결번입니다", List.of());
        assertThat(accepted.getStatus()).isEqualTo(LeadStatuses.AS_REQUESTED);

        LeadAsRequestResponse res = asService.resolve(marketer.getId(), accepted, true, "확인했습니다");
        assertThat(res.status()).isEqualTo("ACCEPTED");
        assertThat(accepted.getStatus()).isEqualTo(LeadStatuses.INVALID);

        Lead rejected = lead();
        statusService.changeByMarketer(marketer.getId(), rejected, LeadStatuses.VALID, null);
        asService.request(advertiser.getId(), rejected, "허위 같습니다", List.of());
        asService.resolve(marketer.getId(), rejected, false, "정상 접수 확인");
        assertThat(rejected.getStatus()).isEqualTo(LeadStatuses.VALID);
    }

    @Test
    @DisplayName("AS 대기 중 리드는 마케터도 일반 상태 변경이 막힌다(인정/거부로만)")
    void asRequestedLocksPlainChange() {
        Lead l = lead();
        asService.request(advertiser.getId(), l, "중복 접수", List.of());
        assertThatThrownBy(() -> statusService.changeByMarketer(marketer.getId(), l, LeadStatuses.VALID, null))
                .isInstanceOf(InvalidSubmissionException.class);
    }

    @Test
    @DisplayName("유효로 확정된 리드는 광고주가 직접 상태를 못 바꾼다 — AS 요청은 계속 가능하다(2026-08-20)")
    void validLocksAdvertiserPlainChangeButAsRequestStillWorks() {
        Lead l = lead();
        statusService.changeByMarketer(marketer.getId(), l, LeadStatuses.VALID, null);

        assertThatThrownBy(() -> statusService.changeByAdvertiser(advertiser.getId(), l, LeadStatuses.NEW, null))
                .isInstanceOf(InvalidSubmissionException.class);

        // 마케터는 그대로 바꿀 수 있다 — 잠기는 건 광고주 쪽뿐.
        statusService.changeByMarketer(marketer.getId(), l, LeadStatuses.NEW, null);
        assertThat(l.getStatus()).isEqualTo(LeadStatuses.NEW);
        statusService.changeByMarketer(marketer.getId(), l, LeadStatuses.VALID, null);

        // 직접 변경은 막히지만 AS 요청으로 마케터에게 넘기는 건 여전히 가능하다.
        asService.request(advertiser.getId(), l, "결번입니다", List.of());
        assertThat(l.getStatus()).isEqualTo(LeadStatuses.AS_REQUESTED);
    }

    @Test
    @DisplayName("AS 요청은 사유가 필수고, 처리 대기 중 중복 접수는 거부된다")
    void asRequestValidation() {
        Lead l = lead();
        assertThatThrownBy(() -> asService.request(advertiser.getId(), l, "  ", List.of()))
                .isInstanceOf(InvalidSubmissionException.class);
        asService.request(advertiser.getId(), l, "결번", List.of());
        assertThatThrownBy(() -> asService.request(advertiser.getId(), l, "또 접수", List.of()))
                .isInstanceOf(InvalidSubmissionException.class);
    }
}
