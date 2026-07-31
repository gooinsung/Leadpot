package com.leadpot.advertiser;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
 * A6 실시간 폴링(새 리드 감지) 검증. 부여받지 않은 폼은 404(격리), since 기준으로 새 리드만 센다.
 */
@SpringBootTest
@Transactional
class AdvertiserUpdatesTest {

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
    private Form otherForm;

    @BeforeEach
    void setUp() {
        marketer = userRepository.save(marketer());
        advertiser = userRepository.save(User.advertiser("upd-a@test.local",
                passwordEncoder.encode("pw12345678"), "광고주", null, marketer.getId(), "회사"));
        form = formRepository.save(new Form(marketer.getId(), "폴링폼", FormType.BASIC));
        otherForm = formRepository.save(new Form(marketer.getId(), "미부여폼", FormType.BASIC));
        saveLead(form);
        advertiserService.replaceGrants(marketer.getId(), advertiser.getId(),
                new GrantUpdateRequest(List.of(
                        new GrantUpdateRequest.Item(form.getId(), null, null, true, true, true))));
    }

    @Test
    @DisplayName("since 가 없으면 기준선만 잡고 0 + serverTime 을 준다")
    void baselineWhenNoSince() {
        Map<String, Object> r = leadService.updates(advertiser.getId(), form.getId(), null);
        assertThat(r.get("newCount")).isEqualTo(0L);
        assertThat(r.get("serverTime")).isNotNull();
    }

    @Test
    @DisplayName("since 이후 접수된 새 리드를 센다")
    void countsNewLeadsAfterSince() {
        String past = Instant.now().minus(1, ChronoUnit.HOURS).toString();
        Map<String, Object> r = leadService.updates(advertiser.getId(), form.getId(), past);
        assertThat((Long) r.get("newCount")).isEqualTo(1L);
    }

    @Test
    @DisplayName("since 가 미래면 새 리드가 없다")
    void noNewLeadsWhenSinceInFuture() {
        String future = Instant.now().plus(1, ChronoUnit.HOURS).toString();
        Map<String, Object> r = leadService.updates(advertiser.getId(), form.getId(), future);
        assertThat((Long) r.get("newCount")).isEqualTo(0L);
    }

    @Test
    @DisplayName("부여받지 않은 폼은 404 (격리)")
    void ungrantedFormIsNotFound() {
        assertThatThrownBy(() -> leadService.updates(advertiser.getId(), otherForm.getId(), null))
                .isInstanceOf(NotFoundException.class);
    }

    private User marketer() {
        User u = new User("upd-m@test.local", passwordEncoder.encode("pw12345678"), "마케터", null);
        u.setSubdomain("upd-m");
        return u;
    }

    private void saveLead(Form form) {
        Lead l = new Lead();
        l.setFormId(form.getId());
        l.setAnswers(List.of(Map.of("label", "이름", "value", "홍길동")));
        leadRepository.save(l);
    }
}
