package com.leadpot.phoneverify;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.RateLimitedException;
import com.leadpot.form.BlockType;
import com.leadpot.form.Form;
import com.leadpot.form.FormBlock;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormType;
import com.leadpot.lead.LeadRepository;
import com.leadpot.lead.LeadService;
import com.leadpot.lead.dto.LeadSubmitRequest;
import com.leadpot.sms.SmsSender;

/**
 * 리드폼 휴대폰 본인인증(V48) 검증.
 *
 * <p>지켜야 하는 것:
 * <ol>
 * <li><b>최종 관문은 접수(서버)</b> — 인증을 켠 폼은 토큰 없이·남의 번호 토큰으로·재사용 토큰으로 접수되면 안 된다.</li>
 * <li><b>시도 제한·쿨다운</b> — 6자리 무제한 대입, 연타 발송(문자 비용)이 막혀야 한다.</li>
 * <li><b>문자를 못 보내면 미인증으로 받는다</b>(사용자 결정 2026-11-09) — 접수는 되고 phone_verified=false.</li>
 * </ol>
 *
 * <p>문자 대행사는 가짜로 바꿔 끼운다 — 실제 발송 없이 '보낸 문자 본문'에서 인증번호를 꺼내 쓴다.
 */
@SpringBootTest(properties = {
        "app.sms.solapi.api-key=test-key",
        "app.sms.solapi.api-secret=test-secret",
        "app.sms.solapi.sender-phone=0212345678",
})
@Transactional
class PhoneVerificationTest {

    private static final String PHONE = "010-1234-5678";
    private static final Pattern CODE = Pattern.compile("\\[(\\d{6})]");

    @MockitoBean
    private SmsSender smsSender;

    @Autowired
    private PhoneVerificationService service;
    @Autowired
    private PhoneVerificationRepository repository;
    @Autowired
    private LeadService leadService;
    @Autowired
    private LeadRepository leadRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private Form form;
    /** 가장 최근에 '보낸' 문자 본문. */
    private final AtomicReference<String> lastText = new AtomicReference<>();

    @BeforeEach
    void setUp() {
        User marketer = new User("pv-marketer@test.local", passwordEncoder.encode("pw12345678"), "마케터", "01000000000");
        marketer.setSubdomain("pv-marketer");
        userRepository.save(marketer);

        form = new Form(marketer.getId(), "인증 폼", FormType.BASIC);
        form.setRequirePhoneVerification(true);
        form.replaceBlocks(List.of(field("이름", "text", 0), field("연락처", "tel", 1)));
        formRepository.save(form);

        sendSucceeds();
    }

    // ---------- 발송·확인 ----------

    @Test
    @DisplayName("발송하면 인증번호 해시만 저장되고 문자가 나간다")
    void sendStoresHashOnly() {
        var r = service.send(form.getId(), PHONE, "1.1.1.1");

        assertThat(r.mode()).isEqualTo("SENT");
        assertThat(r.token()).isNull();
        PhoneVerification v = repository.findAll().get(0);
        assertThat(v.isSmsSent()).isTrue();
        assertThat(v.getCodeHash()).hasSize(64).isNotEqualTo(sentCode());
        assertThat(v.getPhoneHash()).doesNotContain("1234");
    }

    @Test
    @DisplayName("유선 번호·잘못된 번호는 받지 않는다")
    void rejectsNonMobile() {
        assertThatThrownBy(() -> service.send(form.getId(), "02-123-4567", "1.1.1.1"))
                .isInstanceOf(InvalidSubmissionException.class);
        assertThatThrownBy(() -> service.send(form.getId(), "010-12", "1.1.1.1"))
                .isInstanceOf(InvalidSubmissionException.class);
    }

    @Test
    @DisplayName("인증을 끈 리드폼에는 발송하지 않는다")
    void rejectsFormWithoutVerification() {
        form.setRequirePhoneVerification(false);
        assertThatThrownBy(() -> service.send(form.getId(), PHONE, "1.1.1.1"))
                .isInstanceOf(InvalidSubmissionException.class);
    }

    @Test
    @DisplayName("쿨다운 안의 재발송은 막는다(문자 비용 방어)")
    void cooldown() {
        service.send(form.getId(), PHONE, "1.1.1.1");
        assertThatThrownBy(() -> service.send(form.getId(), PHONE, "1.1.1.1"))
                .isInstanceOf(RateLimitedException.class);
    }

    @Test
    @DisplayName("틀린 번호는 횟수를 올리고, 상한을 넘으면 맞는 번호도 거부한다")
    void wrongCodeLocks() {
        service.send(form.getId(), PHONE, "1.1.1.1");
        String code = sentCode();
        String wrong = code.equals("000000") ? "111111" : "000000";
        for (int i = 0; i < PhoneVerification.MAX_ATTEMPTS; i++) {
            assertThatThrownBy(() -> service.confirm(form.getId(), PHONE, wrong))
                    .isInstanceOf(InvalidSubmissionException.class);
        }
        assertThatThrownBy(() -> service.confirm(form.getId(), PHONE, code))
                .isInstanceOf(InvalidSubmissionException.class);
    }

    // ---------- 접수(최종 관문) ----------

    @Test
    @DisplayName("인증을 통과하면 접수되고 '인증됨'으로 저장된다. 토큰은 1회용이다")
    void verifiedSubmit() {
        String token = verify(PHONE);

        Long id = leadService.submit(submit(PHONE, token), visitor());
        assertThat(leadRepository.findById(id).orElseThrow().isPhoneVerified()).isTrue();

        assertThatThrownBy(() -> leadService.submit(submit(PHONE, token), visitor()))
                .isInstanceOf(InvalidSubmissionException.class)
                .hasMessageContaining("인증");
    }

    @Test
    @DisplayName("토큰 없이는 접수되지 않는다 — 화면을 우회한 API 직접 호출 방어")
    void submitWithoutTokenRejected() {
        assertThatThrownBy(() -> leadService.submit(submit(PHONE, null), visitor()))
                .isInstanceOf(InvalidSubmissionException.class)
                .hasMessageContaining("휴대폰 인증");
    }

    @Test
    @DisplayName("인증한 번호와 다른 번호로는 접수되지 않는다")
    void submitWithOtherPhoneRejected() {
        String token = verify(PHONE);
        assertThatThrownBy(() -> leadService.submit(submit("010-9999-8888", token), visitor()))
                .isInstanceOf(InvalidSubmissionException.class);
    }

    @Test
    @DisplayName("다른 리드폼에서 받은 토큰은 쓸 수 없다")
    void tokenBoundToForm() {
        String token = verify(PHONE);
        Form other = new Form(form.getOwnerId(), "다른 폼", FormType.BASIC);
        other.setRequirePhoneVerification(true);
        other.replaceBlocks(List.of(field("연락처", "tel", 0)));
        formRepository.save(other);

        LeadSubmitRequest req = new LeadSubmitRequest(other.getId(), null,
                List.of(Map.of("label", "연락처", "fieldType", "tel", "value", PHONE)), List.of(), null, null, null, token);
        assertThatThrownBy(() -> leadService.submit(req, visitor()))
                .isInstanceOf(InvalidSubmissionException.class);
    }

    @Test
    @DisplayName("문자를 못 보내면 FALLBACK 토큰으로 접수되고 '미인증'으로 저장된다(사용자 결정)")
    void fallbackWhenSmsFails() {
        when(smsSender.send(any(), anyString(), anyString()))
                .thenReturn(SmsSender.SmsResult.failed("대행사 장애", "SMS"));

        var r = service.send(form.getId(), PHONE, "1.1.1.1");
        assertThat(r.mode()).isEqualTo(PhoneVerification.FALLBACK);
        assertThat(r.token()).isNotBlank();
        // 실제로 나가지 않은 문자는 쿨다운·상한에 세지 않는다.
        assertThat(repository.findAll().get(0).isSmsSent()).isFalse();

        Long id = leadService.submit(submit(PHONE, r.token()), visitor());
        assertThat(leadRepository.findById(id).orElseThrow().isPhoneVerified()).isFalse();
    }

    @Test
    @DisplayName("번호별 하루 발송 상한을 넘으면 문자 없이 FALLBACK 으로 넘긴다")
    void dailyCapFallsBack() {
        for (int i = 0; i < PhoneVerificationService.DAILY_CAP_PER_PHONE; i++) {
            repository.save(sentRow());
        }
        var r = service.send(form.getId(), PHONE, "9.9.9.9");
        assertThat(r.mode()).isEqualTo(PhoneVerification.FALLBACK);
    }

    @Test
    @DisplayName("인증을 끈 리드폼은 예전처럼 토큰 없이 접수된다")
    void formWithoutVerificationUnaffected() {
        form.setRequirePhoneVerification(false);
        Long id = leadService.submit(submit(PHONE, null), visitor());
        assertThat(leadRepository.findById(id).orElseThrow().isPhoneVerified()).isFalse();
    }

    // ---------- 도우미 ----------

    private String verify(String phone) {
        service.send(form.getId(), phone, "1.1.1.1");
        return service.confirm(form.getId(), phone, sentCode());
    }

    private void sendSucceeds() {
        when(smsSender.send(any(), anyString(), anyString())).thenAnswer(inv -> {
            lastText.set(inv.getArgument(2));
            return SmsSender.SmsResult.sent("msg-1", "SMS");
        });
    }

    private String sentCode() {
        Matcher m = CODE.matcher(lastText.get());
        assertThat(m.find()).isTrue();
        return m.group(1);
    }

    /** 문자를 보낸 것으로 기록된 행(상한 검사용) — 쿨다운에 걸리지 않게 다른 폼 소속으로 둔다. */
    private PhoneVerification sentRow() {
        Form other = formRepository.save(new Form(form.getOwnerId(), "상한 폼", FormType.BASIC));
        PhoneVerification v = PhoneVerification.pending(other.getId(), VerifyCodes.hash("01012345678"),
                VerifyCodes.hash("123456"), java.time.Instant.now().plusSeconds(180), "1.1.1.1");
        v.markSmsSent();
        return v;
    }

    private LeadSubmitRequest submit(String phone, String token) {
        return new LeadSubmitRequest(form.getId(), null,
                List.of(Map.of("label", "이름", "fieldType", "text", "value", "홍길동"),
                        Map.of("label", "연락처", "fieldType", "tel", "value", phone)),
                List.of(), null, null, null, token);
    }

    private static LeadService.Visitor visitor() {
        return new LeadService.Visitor("1.1.1.1", "JUnit", null, "ko");
    }

    private static FormBlock field(String label, String fieldType, int order) {
        FormBlock b = new FormBlock();
        b.setBlockType(BlockType.FIELD);
        b.setLabel(label);
        b.setFieldType(fieldType);
        b.setSortOrder(order);
        return b;
    }
}
