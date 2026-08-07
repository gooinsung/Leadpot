package com.leadpot.advertiser;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
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
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormType;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadAsRequestService;
import com.leadpot.lead.LeadRepository;
import com.leadpot.lead.LeadStatusService;
import com.leadpot.lead.LeadStatuses;
import com.leadpot.lead.dto.LeadAsRequestResponse;

/**
 * 선입금 과금(V31) + AS 흐름(V30) 검증 — 돈이 걸린 규칙이라 이 테스트가 깨지면
 * 광고주에게 잘못 청구되거나 환급이 누락된다는 뜻이다. 완화하지 말고 원인을 고칠 것.
 *
 * <p>규칙: 유효 진입 시 단가 차감, 이탈 시 환급(리드별 순액으로 중복 방지),
 * AS 인정 → 무효+환급 / 거부 → 유효 확정. 잔액 알림 번호는 마케터 지정 → 광고주 등록 → 없으면 미발송.
 */
@SpringBootTest
@Transactional
class AdvertiserBillingTest {

    @Autowired
    private AdvertiserBillingService billingService;
    @Autowired
    private LeadStatusService statusService;
    @Autowired
    private LeadAsRequestService asService;
    @Autowired
    private AdvertiserService advertiserService;
    @Autowired
    private AdvertiserFormGrantRepository grantRepository;
    @Autowired
    private AdvertiserLedgerRepository ledgerRepository;
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
    private AdvertiserFormGrant grant;

    @BeforeEach
    void setUp() {
        marketer = userRepository.save(newMarketer());
        advertiser = userRepository.save(User.advertiser("bill-a@test.local",
                passwordEncoder.encode("pw12345678"), "광고주", null, marketer.getId(), "회사"));
        form = formRepository.save(new Form(marketer.getId(), "정산폼", FormType.BASIC));
        advertiserService.replaceGrants(marketer.getId(), advertiser.getId(),
                new GrantUpdateRequest(List.of(
                        new GrantUpdateRequest.Item(form.getId(), null, null, true, true, true))));
        grant = grantRepository.findByFormId(form.getId()).orElseThrow();
        // 단가 5만원 계약 + 선입금 10만원
        billingService.updateSettings(form.getId(), 50_000, 5, 50, false, 0, null);
        billingService.charge(form.getId(), 100_000, "선입금", marketer.getId());
        grant = grantRepository.findByFormId(form.getId()).orElseThrow();
    }

    private User newMarketer() {
        User u = new User("bill-m@test.local", passwordEncoder.encode("pw12345678"), "마케터", null);
        u.setSubdomain("bill-m");
        return u;
    }

    private Lead lead() {
        Lead l = new Lead();
        l.setFormId(form.getId());
        l.setAnswers(List.of(Map.of("label", "이름", "value", "홍길동")));
        return leadRepository.save(l);
    }

    private long balance() {
        return ledgerRepository.balance(form.getId());
    }

    @Test
    @DisplayName("💰 유효 확정 시 단가가 차감되고, 유효 해제 시 환급된다")
    void debitOnValidRefundOnLeave() {
        Lead l = lead();
        statusService.changeByMarketer(marketer.getId(), l, LeadStatuses.VALID, null);
        assertThat(balance()).isEqualTo(50_000); // 100,000 − 50,000

        statusService.changeByMarketer(marketer.getId(), l, LeadStatuses.NEW, null);
        assertThat(balance()).isEqualTo(100_000); // 환급
    }

    @Test
    @DisplayName("💰 유효를 여러 번 오가도 중복 차감·중복 환급되지 않는다")
    void noDoubleChargeOrRefund() {
        Lead l = lead();
        statusService.changeByMarketer(marketer.getId(), l, LeadStatuses.VALID, null);
        statusService.changeByMarketer(marketer.getId(), l, LeadStatuses.NEW, null);
        statusService.changeByMarketer(marketer.getId(), l, LeadStatuses.VALID, null);
        assertThat(balance()).isEqualTo(50_000); // 순차감 1건분만
        // 원장: 충전 1 + 차감 2 + 환급 1
        assertThat(ledgerRepository.findTop50ByFormIdOrderByCreatedAtDescIdDesc(form.getId())).hasSize(4);
    }

    @Test
    @DisplayName("💰 단가가 0(계약 없음)이면 원장이 생기지 않는다")
    void noLedgerWithoutContract() {
        billingService.updateSettings(form.getId(), 0, 0, 0, false, 0, null);
        Lead l = lead();
        statusService.changeByMarketer(marketer.getId(), l, LeadStatuses.VALID, null);
        assertThat(ledgerRepository.netChargedForLead(l.getId())).isZero();
    }

    @Test
    @DisplayName("잔액이 마이너스여도 차감은 계속된다(수집 계속, 후정산 — 사용자 확정)")
    void balanceCanGoNegative() {
        statusService.changeByMarketer(marketer.getId(), lead(), LeadStatuses.VALID, null);
        statusService.changeByMarketer(marketer.getId(), lead(), LeadStatuses.VALID, null);
        statusService.changeByMarketer(marketer.getId(), lead(), LeadStatuses.VALID, null);
        assertThat(balance()).isEqualTo(-50_000);
    }

    @Test
    @DisplayName("AS 인정 → 무효 + 환급 / 거부 → 유효 확정(차감 유지)")
    void asFlowAcceptRefundsRejectKeeps() {
        // 유효 확정된 리드에 광고주가 이의 제기
        Lead accepted = lead();
        statusService.changeByMarketer(marketer.getId(), accepted, LeadStatuses.VALID, null);
        asService.request(advertiser.getId(), accepted, "결번입니다", List.of());
        assertThat(accepted.getStatus()).isEqualTo(LeadStatuses.AS_REQUESTED);

        LeadAsRequestResponse res = asService.resolve(marketer.getId(), accepted, true, "확인했습니다");
        assertThat(res.status()).isEqualTo("ACCEPTED");
        assertThat(accepted.getStatus()).isEqualTo(LeadStatuses.INVALID);
        assertThat(balance()).isEqualTo(100_000); // 차감분 환급

        // 거부 케이스 — 유효로 확정되고 차감 유지
        Lead rejected = lead();
        statusService.changeByMarketer(marketer.getId(), rejected, LeadStatuses.VALID, null);
        asService.request(advertiser.getId(), rejected, "허위 같습니다", List.of());
        asService.resolve(marketer.getId(), rejected, false, "정상 접수 확인");
        assertThat(rejected.getStatus()).isEqualTo(LeadStatuses.VALID);
        assertThat(balance()).isEqualTo(50_000);
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
    @DisplayName("AS 요청은 사유가 필수고, 처리 대기 중 중복 접수는 거부된다")
    void asRequestValidation() {
        Lead l = lead();
        assertThatThrownBy(() -> asService.request(advertiser.getId(), l, "  ", List.of()))
                .isInstanceOf(InvalidSubmissionException.class);
        asService.request(advertiser.getId(), l, "결번", List.of());
        assertThatThrownBy(() -> asService.request(advertiser.getId(), l, "또 접수", List.of()))
                .isInstanceOf(InvalidSubmissionException.class);
    }

    @Test
    @DisplayName("잔액 알림: 임계 미만이면 억제 마커가 찍히고, 수신번호가 전혀 없으면 찍히지 않는다")
    void balanceAlertMarkerAndPhoneFallback() {
        // 번호 없음(마케터 지정 X, 광고주 등록 X) → 발송 대상이 없어 마커도 안 찍힌다
        billingService.updateSettings(form.getId(), 50_000, 0, 0, true, 80_000, null);
        Lead l1 = lead();
        statusService.changeByMarketer(marketer.getId(), l1, LeadStatuses.VALID, null); // 잔액 5만 < 8만
        grant = grantRepository.findByFormId(form.getId()).orElseThrow();
        assertThat(grant.getBalanceAlertSentAt()).isNull();

        // 광고주가 수신번호를 등록하면(폴백 대상) 마커가 찍힌다
        grant.setNotifyPhone("01012341234", Instant.now());
        grantRepository.save(grant);
        Lead l2 = lead();
        statusService.changeByMarketer(marketer.getId(), l2, LeadStatuses.VALID, null); // 잔액 0 < 8만
        assertThat(grant.getBalanceAlertSentAt()).isNotNull();

        // 임계 위로 충전하면 억제가 풀린다
        billingService.charge(form.getId(), 500_000, "재충전", marketer.getId());
        grant = grantRepository.findByFormId(form.getId()).orElseThrow();
        assertThat(grant.getBalanceAlertSentAt()).isNull();
    }

    @Test
    @DisplayName("일 목표: 접수 수가 목표에 닿으면 오늘 날짜 마커가 찍힌다(하루 1회)")
    void dailyGoalMarksOncePerDay() {
        billingService.updateSettings(form.getId(), 0, 2, 0, false, 0, null);
        lead();
        Lead second = lead();
        billingService.checkDailyGoal(form, second); // 오늘 2건 = 목표 도달
        grant = grantRepository.findByFormId(form.getId()).orElseThrow();
        assertThat(grant.getGoalAlertDate()).isNotNull();
    }
}
