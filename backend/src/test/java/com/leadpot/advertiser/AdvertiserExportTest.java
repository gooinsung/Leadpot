package com.leadpot.advertiser;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.advertiser.dto.AdvertiserLogResponse;
import com.leadpot.advertiser.dto.GrantUpdateRequest;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.common.error.PlanLimitExceededException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormType;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;

/**
 * A4 광고주 내보내기·감사 로그 검증.
 * <b>리드는 개인정보</b>다. 내보내기 파일에 IP·UTM 이 새거나, 권한 없는 광고주가 내보내거나,
 * 일일 상한이 안 걸리면 이 테스트가 깨져야 한다 — 완화하지 말고 원인을 고칠 것.
 * <p>
 * 감사 로그는 REQUIRES_NEW 로 커밋돼 테스트 롤백으로 되돌아가지 않으므로,
 * 상한 카운트가 서로 안 섞이게 <b>테스트마다 새 광고주</b>를 만든다.
 */
@SpringBootTest
@Transactional
class AdvertiserExportTest {

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

    private static final AtomicInteger SEQ = new AtomicInteger();
    private User marketer;

    @BeforeEach
    void setUp() {
        marketer = userRepository.save(marketer());
    }

    @Test
    @DisplayName("내보내기 컬럼은 접수일시·상태·답변뿐 — IP·UTM 은 없다")
    void exportHasWhitelistColumnsOnly() {
        Fixture f = fixture(true);
        List<List<String>> m = leadService.export(f.advertiserId, f.formId, null, null, null, null, "1.2.3.4");

        List<String> header = m.get(0);
        assertThat(header).containsExactly("접수일시", "상태", "이름", "연락처");
        // 데이터 셀 어디에도 IP·UTM 이 없어야 한다.
        assertThat(m.toString()).doesNotContain("9.9.9.9").doesNotContain("naver");
        // 상태는 광고주 상태 라벨(신규)로 나온다.
        assertThat(m.get(1)).contains("신규");
    }

    @Test
    @DisplayName("파일 하단에 다운로드 워터마크(광고주 이메일·일시)가 붙는다")
    void exportAppendsWatermark() {
        Fixture f = fixture(true);
        List<List<String>> m = leadService.export(f.advertiserId, f.formId, null, null, null, null, "1.2.3.4");
        String last = m.get(m.size() - 1).get(0);
        assertThat(last).startsWith("다운로드: ").contains(f.email);
    }

    @Test
    @DisplayName("내보내면 EXPORT 감사 로그가 남고 마케터 화면에서 조회된다")
    void exportIsAudited() {
        Fixture f = fixture(true);
        leadService.export(f.advertiserId, f.formId, null, null, null, null, "1.2.3.4");

        List<AdvertiserLogResponse> logs = advertiserService.logs(marketer.getId(), f.advertiserId, null);
        assertThat(logs).anySatisfy(l -> {
            assertThat(l.action()).isEqualTo(AdvertiserAccessLog.ACTION_EXPORT);
            assertThat(l.actionLabel()).isEqualTo("내보내기");
            assertThat(l.formId()).isEqualTo(f.formId);
        });
    }

    @Test
    @DisplayName("can_export=false 인 광고주는 내보낼 수 없다")
    void exportBlockedWithoutPermission() {
        Fixture f = fixture(false); // canExport=false
        assertThatThrownBy(() -> leadService.export(f.advertiserId, f.formId, null, null, null, null, "1.2.3.4"))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("일일 상한(테스트=3회)을 넘기면 거부된다")
    void exportDailyLimitEnforced() {
        Fixture f = fixture(true);
        for (int i = 0; i < 3; i++) {
            leadService.export(f.advertiserId, f.formId, null, null, null, null, "1.2.3.4");
        }
        assertThatThrownBy(() -> leadService.export(f.advertiserId, f.formId, null, null, null, null, "1.2.3.4"))
                .isInstanceOf(PlanLimitExceededException.class);
    }

    // ---------- 픽스처 ----------

    private record Fixture(Long advertiserId, Long formId, String email) {
    }

    private Fixture fixture(boolean canExport) {
        int n = SEQ.incrementAndGet();
        String email = "exp-a" + n + "@test.local";
        User advertiser = userRepository.save(User.advertiser(email,
                passwordEncoder.encode("pw12345678"), "광고주" + n, null, marketer.getId(), "회사"));
        Form form = formRepository.save(new Form(marketer.getId(), "내보내기폼" + n, FormType.BASIC));
        saveLead(form);
        advertiserService.replaceGrants(marketer.getId(), advertiser.getId(),
                new GrantUpdateRequest(List.of(
                        new GrantUpdateRequest.Item(form.getId(), null, null, true, true, canExport))));
        return new Fixture(advertiser.getId(), form.getId(), email);
    }

    private User marketer() {
        User u = new User("exp-m" + SEQ.incrementAndGet() + "@test.local",
                passwordEncoder.encode("pw12345678"), "마케터", null);
        u.setSubdomain("exp-m" + SEQ.get());
        return u;
    }

    private void saveLead(Form form) {
        Lead l = new Lead();
        l.setFormId(form.getId());
        l.setAnswers(List.of(
                Map.of("label", "이름", "value", "홍길동"),
                Map.of("label", "연락처", "value", "01011112222")));
        l.setSubmitterIp("9.9.9.9");
        l.setUtm(Map.of("utm_source", "naver"));
        leadRepository.save(l);
    }
}
