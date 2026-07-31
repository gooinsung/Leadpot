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

import com.leadpot.advertiser.dto.AdvertiserLogResponse;
import com.leadpot.advertiser.dto.AdvertiserPreviewLead;
import com.leadpot.advertiser.dto.AdvertiserPreviewResponse;
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
 * A7 광고주 화면 미리보기(impersonate) 검증.
 * <b>핵심: 미리보기는 읽기 전용</b> — 마케터가 상세를 봐도 광고주의 '확인(seen)'이 찍히면 안 된다
 * (§5 분쟁 방어 증거 오염 방지). 진입/이탈은 IMPERSONATE 로 남는다.
 */
@SpringBootTest
@Transactional
class AdvertiserPreviewTest {

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
        marketer = userRepository.save(marketer("prev-m@test.local", "prev-m"));
        advertiser = userRepository.save(User.advertiser("prev-a@test.local",
                passwordEncoder.encode("pw12345678"), "광고주", null, marketer.getId(), "회사"));
        form = formRepository.save(new Form(marketer.getId(), "미리보기폼", FormType.BASIC));
        lead = saveLead();
        advertiserService.replaceGrants(marketer.getId(), advertiser.getId(),
                new GrantUpdateRequest(List.of(
                        new GrantUpdateRequest.Item(form.getId(), null, null, true, true, true))));
    }

    @Test
    @DisplayName("미리보기 상세를 봐도 광고주 '확인(seen)'이 찍히지 않는다")
    void previewDoesNotMarkSeen() {
        AdvertiserPreviewLead pv = advertiserService.previewLead(marketer.getId(), advertiser.getId(), lead.getId());
        assertThat(pv.lead().id()).isEqualTo(lead.getId());

        Lead reloaded = leadRepository.findById(lead.getId()).orElseThrow();
        assertThat(reloaded.getAdvertiserSeenAt()).isNull(); // 마케터가 봤어도 미확인 유지
    }

    @Test
    @DisplayName("미리보기 진입은 폼 목록을 주고 IMPERSONATE 로그를 남긴다")
    void enterReturnsFormsAndLogsImpersonate() {
        AdvertiserPreviewResponse r = advertiserService.previewEnter(marketer.getId(), advertiser.getId(), "1.2.3.4");
        assertThat(r.forms()).hasSize(1);

        List<AdvertiserLogResponse> logs = advertiserService.logs(marketer.getId(), advertiser.getId(), null);
        assertThat(logs).anySatisfy(l -> assertThat(l.action()).isEqualTo(AdvertiserAccessLog.ACTION_IMPERSONATE));
    }

    @Test
    @DisplayName("이탈도 IMPERSONATE 로 기록된다")
    void exitIsLogged() {
        advertiserService.previewExit(marketer.getId(), advertiser.getId(), "1.2.3.4");
        List<AdvertiserLogResponse> logs = advertiserService.logs(marketer.getId(), advertiser.getId(), null);
        assertThat(logs).anySatisfy(l -> {
            assertThat(l.action()).isEqualTo(AdvertiserAccessLog.ACTION_IMPERSONATE);
            assertThat(l.detail()).contains("종료");
        });
    }

    @Test
    @DisplayName("다른 마케터는 이 광고주를 미리보기할 수 없다 (404)")
    void otherMarketerCannotPreview() {
        User other = userRepository.save(marketer("prev-m2@test.local", "prev-m2"));
        assertThatThrownBy(() -> advertiserService.previewEnter(other.getId(), advertiser.getId(), "1.2.3.4"))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> advertiserService.previewLead(other.getId(), advertiser.getId(), lead.getId()))
                .isInstanceOf(NotFoundException.class);
    }

    private User marketer(String email, String sub) {
        User u = new User(email, passwordEncoder.encode("pw12345678"), "마케터", null);
        u.setSubdomain(sub);
        return u;
    }

    private Lead saveLead() {
        Lead l = new Lead();
        l.setFormId(form.getId());
        l.setAnswers(List.of(Map.of("label", "이름", "value", "홍길동")));
        return leadRepository.save(l);
    }
}
