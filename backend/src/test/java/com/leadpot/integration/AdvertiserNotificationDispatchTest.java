package com.leadpot.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormType;
import com.leadpot.integration.NotificationService.Dispatch;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;

/**
 * A5 알림 대상 선정 검증. {@link NotificationService#planDispatches}는 순수 조회라
 * 실제 HTTP 발송 없이 "누구에게 어떤 메시지가 나갈지"를 결정적으로 검증할 수 있다.
 * <p>
 * <b>리드는 개인정보</b>다. 광고주 메시지에 IP·UTM 이 새거나, 만료·정지된 광고주에게
 * 발송 대상이 잡히면 이 테스트가 깨져야 한다 — 완화하지 말고 원인을 고칠 것.
 */
@SpringBootTest
@Transactional
class AdvertiserNotificationDispatchTest {

    @Autowired
    private NotificationService notificationService;
    @Autowired
    private IntegrationSettingsRepository settingsRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private LeadRepository leadRepository;
    @Autowired
    private AdvertiserService advertiserService;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private User marketer;
    private User advertiser;
    private Form form;
    private Lead lead;

    @BeforeEach
    void setUp() {
        marketer = userRepository.save(marketer("notif-m@test.local", "notif-m"));
        advertiser = userRepository.save(User.advertiser("notif-a@test.local",
                passwordEncoder.encode("pw12345678"), "광고주담당", null, marketer.getId(), "A성형외과"));
        form = formRepository.save(new Form(marketer.getId(), "성형 상담 신청", FormType.BASIC));
        lead = saveLead(form);

        // 마케터 텔레그램 채널 on
        settingsRepository.save(telegram(marketer.getId(), "M-TOKEN", "M-CHAT"));
        // 광고주에게 표시 이름 "A성형" 으로 폼 부여
        grant("A성형", null);
    }

    // ---------- 대상 선정 ----------

    @Test
    @DisplayName("광고주 채널이 없으면 마케터에게만 발송된다")
    void marketerOnlyWhenAdvertiserHasNoChannel() {
        List<Dispatch> d = notificationService.planDispatches(form, lead, false);
        assertThat(d).singleElement()
                .satisfies(x -> assertThat(x.recipientUserId()).isEqualTo(marketer.getId()));
    }

    @Test
    @DisplayName("광고주도 텔레그램을 켜면 마케터·광고주 양쪽이 대상이 된다")
    void bothWhenAdvertiserTelegramEnabled() {
        settingsRepository.save(telegram(advertiser.getId(), "A-TOKEN", "A-CHAT"));

        List<Dispatch> d = notificationService.planDispatches(form, lead, true);

        assertThat(d).hasSize(2);
        assertThat(d).extracting(Dispatch::recipientUserId)
                .containsExactlyInAnyOrder(marketer.getId(), advertiser.getId());
    }

    @Test
    @DisplayName("광고주 메시지: 표시이름·딥링크는 넣고, IP·UTM·중복문구는 넣지 않는다")
    void advertiserMessageIsSanitized() {
        settingsRepository.save(telegram(advertiser.getId(), "A-TOKEN", "A-CHAT"));

        // duplicate=true 여도 광고주에겐 중복 문구가 나가지 않아야 한다.
        Dispatch adv = advertiserDispatch(notificationService.planDispatches(form, lead, true));

        assertThat(adv.payload())
                .contains("A성형")                                  // grant.displayName
                .contains("/client?form=" + form.getId() + "&lead=" + lead.getId()) // 딥링크
                .doesNotContain("1.2.3.4")                          // IP 없음
                .doesNotContain("naver")                            // UTM 없음
                .doesNotContain("중복");                            // 마케터 내부 판단 문구 없음
    }

    @Test
    @DisplayName("마케터 메시지에는 중복 의심 문구가 들어간다(광고주와 대비)")
    void marketerMessageKeepsDuplicateNote() {
        Dispatch mk = marketerDispatch(notificationService.planDispatches(form, lead, true));
        assertThat(mk.payload()).contains("중복");
    }

    @Test
    @DisplayName("만료된 권한의 광고주는 발송 대상에서 제외된다")
    void expiredGrantExcludesAdvertiser() {
        settingsRepository.save(telegram(advertiser.getId(), "A-TOKEN", "A-CHAT"));
        grant("A성형", Instant.now().minus(1, ChronoUnit.DAYS)); // 어제 만료

        List<Dispatch> d = notificationService.planDispatches(form, lead, false);
        assertThat(d).extracting(Dispatch::recipientUserId).containsExactly(marketer.getId());
    }

    @Test
    @DisplayName("정지된 광고주는 발송 대상에서 제외된다")
    void inactiveAdvertiserExcluded() {
        settingsRepository.save(telegram(advertiser.getId(), "A-TOKEN", "A-CHAT"));
        advertiser.setActive(false);
        userRepository.save(advertiser);

        List<Dispatch> d = notificationService.planDispatches(form, lead, false);
        assertThat(d).extracting(Dispatch::recipientUserId).containsExactly(marketer.getId());
    }

    @Test
    @DisplayName("마케터의 폼별 알림 토글(off)은 광고주 발송을 막지 않는다 — 서로 독립")
    void marketerFormToggleDoesNotSilenceAdvertiser() {
        settingsRepository.save(telegram(advertiser.getId(), "A-TOKEN", "A-CHAT"));
        form.setSettingsConfig(Map.of("notifyEnabled", false));
        formRepository.save(form);

        List<Dispatch> d = notificationService.planDispatches(form, lead, false);
        // 마케터 텔레그램은 꺼지고, 광고주 텔레그램만 남는다.
        assertThat(d).extracting(Dispatch::recipientUserId).containsExactly(advertiser.getId());
    }

    // ---------- 헬퍼 ----------

    private User marketer(String email, String subdomain) {
        User u = new User(email, passwordEncoder.encode("pw12345678"), "마케터", null);
        u.setSubdomain(subdomain);
        return u;
    }

    private IntegrationSettings telegram(Long ownerId, String token, String chatId) {
        IntegrationSettings s = settingsRepository.findById(ownerId).orElseGet(() -> new IntegrationSettings(ownerId));
        s.setTelegramBotToken(token);
        s.setTelegramChatId(chatId);
        s.setTelegramEnabled(true);
        return s;
    }

    private void grant(String displayName, Instant expiresAt) {
        advertiserService.replaceGrants(marketer.getId(), advertiser.getId(),
                new GrantUpdateRequest(List.of(
                        new GrantUpdateRequest.Item(form.getId(), displayName, expiresAt, true, true, true))));
    }

    private Lead saveLead(Form form) {
        Lead l = new Lead();
        l.setFormId(form.getId());
        l.setAnswers(List.of(
                Map.of("label", "이름", "value", "홍길동"),
                Map.of("label", "연락처", "value", "01011112222")));
        l.setSubmitterIp("1.2.3.4");
        l.setDevice("MOBILE");
        l.setOs("iOS");
        l.setBrowser("Safari");
        l.setUtm(Map.of("utm_source", "naver"));
        return leadRepository.save(l);
    }

    private Dispatch advertiserDispatch(List<Dispatch> all) {
        return all.stream().filter(x -> x.recipientUserId().equals(advertiser.getId())).findFirst().orElseThrow();
    }

    private Dispatch marketerDispatch(List<Dispatch> all) {
        return all.stream().filter(x -> x.recipientUserId().equals(marketer.getId())).findFirst().orElseThrow();
    }
}
