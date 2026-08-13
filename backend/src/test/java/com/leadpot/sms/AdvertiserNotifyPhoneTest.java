package com.leadpot.sms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.advertiser.AdvertiserFormGrantRepository;
import com.leadpot.advertiser.AdvertiserLeadService;
import com.leadpot.advertiser.AdvertiserService;
import com.leadpot.advertiser.dto.AdvertiserNotifyStatus;
import com.leadpot.advertiser.dto.GrantUpdateRequest;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormType;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;

/**
 * V28 — 광고주 접수 알림 수신번호는 <b>광고주 본인만</b> 등록할 수 있고, 등록해야만 발송된다.
 *
 * <p>왜 이 테스트가 중요한가: 예전에는 마케터가 리드폼 설정에 남의 번호를 적으면 그대로 발송됐다.
 * 번호 주인은 동의한 적도 끌 수도 없었고, 발신 채널이 리드팟 명의 하나라 신고 한 번에
 * 전 고객 알림이 막힌다(docs/MESSAGING-PLAN.md §9).
 * <b>마케터가 넣은 번호로 문자가 나가면 이 테스트가 깨져야 한다 — 완화하지 말고 원인을 고칠 것.</b>
 */
@SpringBootTest
@Transactional
class AdvertiserNotifyPhoneTest {

    @Autowired
    private LeadSmsPlanner planner;
    @Autowired
    private AdvertiserLeadService advertiserLeadService;
    @Autowired
    private AdvertiserService advertiserService;
    @Autowired
    private AdvertiserFormGrantRepository grantRepository;
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
        marketer = userRepository.save(marketer("notify-m@test.local", "notify-m"));
        advertiser = userRepository.save(User.advertiser("notify-a@test.local",
                passwordEncoder.encode("pw12345678"), "광고주담당", null, marketer.getId(), "A성형외과"));
        form = formRepository.save(new Form(marketer.getId(), "성형 상담 신청", FormType.BASIC));
        lead = saveLead();
        enableAdvertiserSms();
        grant(null);
    }

    // ---------- 발송 판정 ----------

    @Test
    @DisplayName("광고주가 번호를 등록하지 않으면 수신번호가 비어 SKIPPED 로 남는다")
    void noPhoneMeansNoRecipient() {
        SmsService.SmsRequest req = advertiserRequest();
        assertThat(req.to()).isEmpty();
    }

    @Test
    @DisplayName("광고주가 직접 등록한 번호로 발송된다")
    void sendsToPhoneRegisteredByAdvertiser() {
        advertiserLeadService.updateNotifyPhone(advertiser.getId(), form.getId(), "010-3333-4444");

        assertThat(advertiserRequest().to()).isEqualTo("01033334444");
    }

    @Test
    @DisplayName("🔴 마케터가 리드폼 설정에 넣어둔 번호는 무시된다 — 동의 근거가 없다")
    void ignoresPhoneEnteredByMarketer() {
        // V28 이전에 저장된 값이 남아 있는 상황. 읽으면 안 된다.
        Map<String, Object> cfg = new LinkedHashMap<>(form.getSettingsConfig());
        cfg.put("smsAdvertiserPhone", "01099998888");
        form.setSettingsConfig(cfg);
        formRepository.save(form);

        assertThat(advertiserRequest().to())
                .as("마케터가 대신 넣은 번호로 발송되면 안 된다")
                .isEmpty();
    }

    @Test
    @DisplayName("🔴 광고주 계정 연락처로 폴백하지 않는다 — 등록 행위가 있어야 동의다")
    void doesNotFallBackToAccountPhone() {
        advertiser.setPhone("01055556666");
        userRepository.save(advertiser);

        assertThat(advertiserRequest().to()).isEmpty();
    }

    @Test
    @DisplayName("번호를 비우면 발송이 멈춘다")
    void clearingPhoneStopsDispatch() {
        advertiserLeadService.updateNotifyPhone(advertiser.getId(), form.getId(), "01033334444");
        advertiserLeadService.updateNotifyPhone(advertiser.getId(), form.getId(), "");

        assertThat(advertiserRequest().to()).isEmpty();
    }

    @Test
    @DisplayName("정지된 광고주에게는 등록된 번호가 있어도 보내지 않는다")
    void inactiveAdvertiserIsNotSent() {
        advertiserLeadService.updateNotifyPhone(advertiser.getId(), form.getId(), "01033334444");
        advertiser.setActive(false);
        userRepository.save(advertiser);

        assertThat(advertiserRequest().to()).isEmpty();
    }

    @Test
    @DisplayName("만료된 권한이면 등록된 번호가 있어도 보내지 않는다")
    void expiredGrantIsNotSent() {
        advertiserLeadService.updateNotifyPhone(advertiser.getId(), form.getId(), "01033334444");
        grant(Instant.now().minus(1, ChronoUnit.DAYS));

        assertThat(advertiserRequest().to()).isEmpty();
    }

    @Test
    @DisplayName("마케터가 토글을 끄면 번호가 등록돼 있어도 발송 목록에 오르지 않는다")
    void toggleOffRemovesDispatch() {
        advertiserLeadService.updateNotifyPhone(advertiser.getId(), form.getId(), "01033334444");
        form.setSettingsConfig(Map.of("smsAdvertiserEnabled", false));
        formRepository.save(form);

        assertThat(planner.plan(form, lead)).isEmpty();
    }

    // ---------- 등록 권한 ----------

    @Test
    @DisplayName("권한 없는 리드폼의 번호는 등록할 수 없다")
    void cannotRegisterForFormWithoutGrant() {
        Form other = formRepository.save(new Form(marketer.getId(), "다른 폼", FormType.BASIC));

        assertThatThrownBy(() -> advertiserLeadService.updateNotifyPhone(
                advertiser.getId(), other.getId(), "01033334444"))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("형식이 아닌 번호는 400 으로 거부한다")
    void rejectsMalformedPhone() {
        assertThatThrownBy(() -> advertiserLeadService.updateNotifyPhone(
                advertiser.getId(), form.getId(), "12345"))
                .isInstanceOf(InvalidSubmissionException.class);
    }

    @Test
    @DisplayName("등록 시각이 남는다 — 수신 동의 시점의 근거")
    void recordsConsentTimestamp() {
        Instant before = Instant.now().minusSeconds(1);
        advertiserLeadService.updateNotifyPhone(advertiser.getId(), form.getId(), "01033334444");

        assertThat(grantRepository.findByFormId(form.getId()).orElseThrow().getNotifyPhoneAt())
                .isNotNull()
                .isAfter(before);
    }

    // ---------- 마케터에게 보여줄 상태 ----------

    @Test
    @DisplayName("마케터 상태 조회: 미등록이면 registered=false, 번호는 내려주지 않는다")
    void statusHidesPhoneWhenNotRegistered() {
        AdvertiserNotifyStatus s = advertiserService.notifyStatus(marketer.getId(), form.getId());

        assertThat(s.linked()).isTrue();
        assertThat(s.registered()).isFalse();
        assertThat(s.phoneMasked()).isNull();
    }

    @Test
    @DisplayName("🔴 마케터에게는 마스킹된 번호만 보인다 — 광고주 번호 수집 통로가 되면 안 된다")
    void statusMasksPhoneForMarketer() {
        advertiserLeadService.updateNotifyPhone(advertiser.getId(), form.getId(), "01033334444");

        AdvertiserNotifyStatus s = advertiserService.notifyStatus(marketer.getId(), form.getId());

        assertThat(s.registered()).isTrue();
        assertThat(s.phoneMasked()).isEqualTo("0103333····");
        assertThat(s.phoneMasked()).doesNotContain("4444");
    }

    @Test
    @DisplayName("광고주가 연결돼 있지 않으면 linked=false")
    void statusNotLinkedWithoutGrant() {
        Form other = formRepository.save(new Form(marketer.getId(), "광고주 없는 폼", FormType.BASIC));

        assertThat(advertiserService.notifyStatus(marketer.getId(), other.getId()).linked()).isFalse();
    }

    @Test
    @DisplayName("남의 리드폼 상태는 조회할 수 없다")
    void statusRejectsOtherMarketersForm() {
        User other = userRepository.save(marketer("notify-x@test.local", "notify-x"));

        assertThatThrownBy(() -> advertiserService.notifyStatus(other.getId(), form.getId()))
                .isInstanceOf(NotFoundException.class);
    }

    // ---------- V33: 계정 기본 번호 + 리드폼별 덮어쓰기 ----------

    /**
     * V33 의 핵심. 폼마다 다시 등록해야 했던 게 실제로 알림 유실로 이어졌다
     * (2026-08-13: 폼 24 는 등록됐고 새 폼 33 은 미등록 → 그 폼만 광고주 알림이 안 나갔다).
     */
    @Test
    @DisplayName("폼 전용 번호가 없으면 계정 기본 번호로 발송된다")
    void fallsBackToAccountDefault() {
        enableAdvertiserSms();
        grant(null);
        advertiserLeadService.updateDefaultNotifyPhone(advertiser.getId(), "010-5555-6666");

        assertThat(advertiserRequest().to()).isEqualTo("01055556666");
    }

    @Test
    @DisplayName("폼 전용 번호가 계정 기본 번호보다 우선한다")
    void formPhoneWinsOverAccountDefault() {
        enableAdvertiserSms();
        grant(null);
        advertiserLeadService.updateDefaultNotifyPhone(advertiser.getId(), "01055556666");
        advertiserLeadService.updateNotifyPhone(advertiser.getId(), form.getId(), "01077778888");

        assertThat(advertiserRequest().to()).isEqualTo("01077778888");
    }

    @Test
    @DisplayName("폼 전용 번호를 비우면 계정 기본 번호로 돌아간다(발송이 멈추지 않는다)")
    void clearingFormPhoneRestoresAccountDefault() {
        enableAdvertiserSms();
        grant(null);
        advertiserLeadService.updateDefaultNotifyPhone(advertiser.getId(), "01055556666");
        advertiserLeadService.updateNotifyPhone(advertiser.getId(), form.getId(), "01077778888");

        advertiserLeadService.updateNotifyPhone(advertiser.getId(), form.getId(), "");

        assertThat(advertiserRequest().to()).isEqualTo("01055556666");
    }

    @Test
    @DisplayName("이 폼만 끄면 계정 기본 번호가 있어도 발송하지 않는다")
    void perFormDisableStopsSending() {
        enableAdvertiserSms();
        grant(null);
        advertiserLeadService.updateDefaultNotifyPhone(advertiser.getId(), "01055556666");

        advertiserLeadService.updateNotifyDisabled(advertiser.getId(), form.getId(), true);

        // 목록에서 빼지 않고 빈 수신번호로 남긴다 — SKIPPED 로 이력에 남아야 추적이 된다.
        assertThat(advertiserRequest().to()).isBlank();
    }

    @Test
    @DisplayName("껐다가 다시 켜면 계정 기본 번호로 재개된다")
    void perFormDisableCanBeUndone() {
        enableAdvertiserSms();
        grant(null);
        advertiserLeadService.updateDefaultNotifyPhone(advertiser.getId(), "01055556666");
        advertiserLeadService.updateNotifyDisabled(advertiser.getId(), form.getId(), true);

        advertiserLeadService.updateNotifyDisabled(advertiser.getId(), form.getId(), false);

        assertThat(advertiserRequest().to()).isEqualTo("01055556666");
    }

    /**
     * ⚠️ 가입 연락처는 수신 동의가 아니다. 계정 기본 번호가 생겼다고 여기로 폴백하면
     * V28 이 막아둔 구멍이 다시 열린다 — 이 테스트가 깨지면 완화하지 말고 원인을 고칠 것.
     */
    @Test
    @DisplayName("가입 연락처(users.phone)로는 절대 폴백하지 않는다")
    void neverFallsBackToSignupPhone() {
        enableAdvertiserSms();
        grant(null);
        advertiser.setPhone("01099998888");
        userRepository.save(advertiser);

        assertThat(advertiserRequest().to()).isBlank();
    }

    @Test
    @DisplayName("계정 기본 번호도 형식이 틀리면 거부한다")
    void rejectsMalformedAccountDefault() {
        assertThatThrownBy(() -> advertiserLeadService.updateDefaultNotifyPhone(advertiser.getId(), "010-1"))
                .isInstanceOf(InvalidSubmissionException.class);
    }

    @Test
    @DisplayName("마케터 상태 조회에 번호 출처가 표시된다(계정 기본 / 폼 전용)")
    void notifyStatusShowsSource() {
        enableAdvertiserSms();
        grant(null);
        advertiserLeadService.updateDefaultNotifyPhone(advertiser.getId(), "01055556666");

        AdvertiserNotifyStatus byAccount = advertiserService.notifyStatus(marketer.getId(), form.getId());
        assertThat(byAccount.registered()).isTrue();
        assertThat(byAccount.source()).isEqualTo(AdvertiserNotifyStatus.SOURCE_ACCOUNT);
        assertThat(byAccount.disabledByAdvertiser()).isFalse();

        advertiserLeadService.updateNotifyPhone(advertiser.getId(), form.getId(), "01077778888");
        AdvertiserNotifyStatus byForm = advertiserService.notifyStatus(marketer.getId(), form.getId());
        assertThat(byForm.source()).isEqualTo(AdvertiserNotifyStatus.SOURCE_FORM);
    }

    @Test
    @DisplayName("마케터 상태 조회는 '광고주가 껐음'을 미등록과 구분해 알려준다")
    void notifyStatusDistinguishesDisabled() {
        enableAdvertiserSms();
        grant(null);
        advertiserLeadService.updateDefaultNotifyPhone(advertiser.getId(), "01055556666");
        advertiserLeadService.updateNotifyDisabled(advertiser.getId(), form.getId(), true);

        AdvertiserNotifyStatus status = advertiserService.notifyStatus(marketer.getId(), form.getId());
        assertThat(status.registered()).isFalse();
        assertThat(status.disabledByAdvertiser()).isTrue();
        // 마케터에게 번호를 노출하지 않는다 — 발송 불가 상태에서는 마스킹 값도 주지 않는다.
        assertThat(status.phoneMasked()).isNull();
    }

    @Test
    @DisplayName("권한 없는 리드폼은 끌 수도 없다")
    void cannotDisableFormWithoutGrant() {
        Form other = formRepository.save(new Form(marketer.getId(), "다른 폼", FormType.BASIC));

        assertThatThrownBy(() -> advertiserLeadService.updateNotifyDisabled(
                advertiser.getId(), other.getId(), true))
                .isInstanceOf(NotFoundException.class);
    }

    // ---------- 헬퍼 ----------

    /** 이 리드에 대해 광고주에게 나갈 문자 1건. 토글이 켜져 있으면 번호가 없어도 목록에는 오른다. */
    private SmsService.SmsRequest advertiserRequest() {
        return planner.plan(form, lead).stream()
                .filter(r -> MessageLog.TO_ADVERTISER.equals(r.recipientType()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("광고주 발송 건이 계획에 없다"));
    }

    private void enableAdvertiserSms() {
        form.setSettingsConfig(Map.of("smsAdvertiserEnabled", true));
        formRepository.save(form);
    }

    private void grant(Instant expiresAt) {
        advertiserService.replaceGrants(marketer.getId(), advertiser.getId(),
                new GrantUpdateRequest(List.of(
                        new GrantUpdateRequest.Item(form.getId(), "A성형", expiresAt, true, true, true))));
    }

    private User marketer(String email, String subdomain) {
        User u = new User(email, passwordEncoder.encode("pw12345678"), "마케터", null);
        u.setSubdomain(subdomain);
        return u;
    }

    private Lead saveLead() {
        Lead l = new Lead();
        l.setFormId(form.getId());
        l.setAnswers(List.of(Map.of("label", "이름", "value", "홍길동")));
        return leadRepository.save(l);
    }
}
