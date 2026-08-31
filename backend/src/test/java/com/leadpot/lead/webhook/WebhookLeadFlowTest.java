package com.leadpot.lead.webhook;

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

import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.form.BlockType;
import com.leadpot.form.FormService;
import com.leadpot.form.FormType;
import com.leadpot.form.dto.FormBlockDto;
import com.leadpot.form.dto.FormRequest;
import com.leadpot.form.dto.FormResponse;
import com.leadpot.form.dto.WebhookLeadConfigResponse;
import com.leadpot.form.dto.WebhookMappingRequest;
import com.leadpot.form.dto.WebhookTokenResponse;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;

/**
 * 범용 인바운드 웹훅 리드 수신(V39) 종단 검증 — 웹훅 켜기 → 매핑 저장 → 페이로드 수신 →
 * 리드 저장까지, 벤더(LeadsBridge·Zapier 등) 없이도 이 서비스만으로 실제 동작을 증명한다.
 */
@SpringBootTest
@Transactional
class WebhookLeadFlowTest {

    @Autowired
    private FormService formService;
    @Autowired
    private WebhookLeadService webhookLeadService;
    @Autowired
    private LeadRepository leadRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private Long ownerId;

    @BeforeEach
    void setUp() {
        User marketer = userRepository.save(
                new User("webhook-flow@test.local", passwordEncoder.encode("pw12345678"), "웹훅테스트", null));
        ownerId = marketer.getId();
    }

    @Test
    @DisplayName("동의 포함 페이로드 → 리드 저장, 같은 external id 재전송 → 멱등(중복 저장 안 됨)")
    void receiveAndDedupe() {
        FormBlockDto name = new FormBlockDto(null, null, 0, BlockType.FIELD, "text", null,
                "이름", true, false, null, null, null);
        FormBlockDto phone = new FormBlockDto(null, null, 1, BlockType.FIELD, "tel", null,
                "연락처", true, false, null, null, null);
        Map<String, Object> consentConfig = Map.of("items",
                List.of(Map.of("title", "개인정보 수집 동의", "required", true)));
        FormRequest req = new FormRequest("웹훅 리드폼", null, FormType.BASIC, false,
                consentConfig, null, null, null, null, null, null, List.of(name, phone));
        FormResponse form = formService.create(ownerId, req);
        WebhookTokenResponse enabled = formService.enableWebhook(ownerId, form.id());
        formService.saveWebhookMapping(ownerId, form.id(), new WebhookMappingRequest(
                Map.of("name", "이름", "phone", "연락처"),
                Map.of("agree", "개인정보 수집 동의"),
                "leadId", List.of()));

        Map<String, Object> payload = Map.of(
                "name", "홍길동",
                "phone", "01012345678",
                "agree", true,
                "leadId", "meta-lead-abc123");

        boolean created = webhookLeadService.receive(enabled.token(), payload);
        assertThat(created).isTrue();

        List<Lead> leads = leadRepository.findByFormIdAndDeletedAtIsNullOrderByCreatedAtDesc(form.id());
        assertThat(leads).hasSize(1);
        Lead lead = leads.get(0);
        assertThat(lead.getExternalId()).isEqualTo("meta-lead-abc123");
        assertThat(lead.getAnswers()).anySatisfy(a -> {
            assertThat(a.get("label")).isEqualTo("이름");
            assertThat(a.get("value")).isEqualTo("홍길동");
        });
        assertThat(lead.getConsents()).anySatisfy(c -> {
            assertThat(c.get("title")).isEqualTo("개인정보 수집 동의");
            assertThat(c.get("agreed")).isEqualTo(true);
        });

        // 같은 leadId 로 재전송(웹훅 재시도 상황) — 새 리드가 또 생기면 안 된다.
        boolean createdAgain = webhookLeadService.receive(enabled.token(), payload);
        assertThat(createdAgain).isFalse();
        assertThat(leadRepository.findByFormIdAndDeletedAtIsNullOrderByCreatedAtDesc(form.id())).hasSize(1);

        // 웹훅 설정 화면에도 최근 수신 이력이 남는다.
        WebhookLeadConfigResponse cfg = formService.getWebhookConfig(ownerId, form.id());
        assertThat(cfg.lastReceivedAt()).isNotNull();
        assertThat(cfg.lastError()).isNull();
    }

    @Test
    @DisplayName("필수 동의가 매핑 안 되면(agreed=false) 저장을 거부한다 — 접수 자체가 안 된다")
    void rejectsWhenRequiredConsentMissing() {
        FormBlockDto name = new FormBlockDto(null, null, 0, BlockType.FIELD, "text", null,
                "이름", true, false, null, null, null);
        Map<String, Object> consentConfig = Map.of("items",
                List.of(Map.of("title", "개인정보 수집 동의", "required", true)));
        FormRequest req = new FormRequest("웹훅 리드폼(거부)", null, FormType.BASIC, false,
                consentConfig, null, null, null, null, null, null, List.of(name));
        FormResponse f2 = formService.create(ownerId, req);
        WebhookTokenResponse enabled = formService.enableWebhook(ownerId, f2.id());
        formService.saveWebhookMapping(ownerId, f2.id(), new WebhookMappingRequest(
                Map.of("name", "이름"), Map.of(), null, List.of())); // 동의 매핑을 일부러 비움

        Map<String, Object> payload = Map.of("name", "김철수");

        assertThatThrownBy(() -> webhookLeadService.receive(enabled.token(), payload))
                .isInstanceOf(InvalidSubmissionException.class);
        assertThat(leadRepository.findByFormIdAndDeletedAtIsNullOrderByCreatedAtDesc(f2.id())).isEmpty();

        // 실패도 최근 오류로 기록돼 마케터가 화면에서 바로 본다.
        WebhookLeadConfigResponse after = formService.getWebhookConfig(ownerId, f2.id());
        assertThat(after.lastError()).isNotNull();
    }

    @Test
    @DisplayName("동의 항목을 '항상 동의'로 지정하면 페이로드에 값이 없어도 저장된다")
    void alwaysAgreedConsentBypassesMapping() {
        FormBlockDto name = new FormBlockDto(null, null, 0, BlockType.FIELD, "text", null,
                "이름", true, false, null, null, null);
        Map<String, Object> consentConfig = Map.of("items",
                List.of(Map.of("title", "개인정보 수집 동의", "required", true)));
        FormRequest req = new FormRequest("웹훅 리드폼(항상동의)", null, FormType.BASIC, false,
                consentConfig, null, null, null, null, null, null, List.of(name));
        FormResponse f3 = formService.create(ownerId, req);
        WebhookTokenResponse enabled = formService.enableWebhook(ownerId, f3.id());
        formService.saveWebhookMapping(ownerId, f3.id(), new WebhookMappingRequest(
                Map.of("name", "이름"), Map.of(), null, List.of("개인정보 수집 동의")));

        // 페이로드에 동의를 나타내는 값이 아예 없다 — 메타 폼처럼 원본이 동의를 이미 전제하는 경우.
        Map<String, Object> payload = Map.of("name", "박영희");

        boolean created = webhookLeadService.receive(enabled.token(), payload);
        assertThat(created).isTrue();

        List<Lead> leads = leadRepository.findByFormIdAndDeletedAtIsNullOrderByCreatedAtDesc(f3.id());
        assertThat(leads).hasSize(1);
        assertThat(leads.get(0).getConsents()).anySatisfy(c -> {
            assertThat(c.get("title")).isEqualTo("개인정보 수집 동의");
            assertThat(c.get("agreed")).isEqualTo(true);
        });
    }

    @Test
    @DisplayName("잘못된 토큰이면 404(NotFoundException)")
    void wrongTokenNotFound() {
        assertThatThrownBy(() -> webhookLeadService.receive("존재하지-않는-토큰", Map.of("a", "b")))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("SELF 폼(공개 렌더용)은 웹훅 토큰이 없으므로 웹훅 경로로 못 들어온다")
    void selfFormHasNoWebhookToken() {
        FormRequest req = new FormRequest("일반 리드폼", null, FormType.BASIC, false,
                null, null, null, null, null, null, null, List.of());
        FormResponse form = formService.create(ownerId, req);
        assertThat(form.source().name()).isEqualTo("SELF");
        WebhookLeadConfigResponse cfg = formService.getWebhookConfig(ownerId, form.id());
        assertThat(cfg.enabled()).isFalse();
        assertThat(cfg.hasToken()).isFalse();
    }
}
