package com.leadpot.adautomation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.adautomation.connection.AdConnection;
import com.leadpot.adautomation.connection.AdConnectionRepository;
import com.leadpot.adautomation.connection.AdConnectionService;
import com.leadpot.adautomation.dto.AdAutomationDtos.ConnectionRequest;
import com.leadpot.adautomation.dto.AdAutomationDtos.RuleRequest;
import com.leadpot.adautomation.dto.AdAutomationDtos.RuleResponse;
import com.leadpot.adautomation.dto.AdAutomationDtos.RuleTargetDto;
import com.leadpot.adautomation.platform.AdPlatform;
import com.leadpot.adautomation.platform.AdPlatformClient;
import com.leadpot.adautomation.platform.AdPlatformClients;
import com.leadpot.adautomation.platform.AdPlatformException;
import com.leadpot.adautomation.rule.AdRuleRepository;
import com.leadpot.adautomation.rule.AdRuleService;
import com.leadpot.adautomation.rule.DailyLeadCountCondition;
import com.leadpot.adautomation.rule.PauseCampaignsAction;
import com.leadpot.adautomation.run.AdActionLog;
import com.leadpot.adautomation.run.AdActionLogRepository;
import com.leadpot.adautomation.run.AdRuleEngine;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormType;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;

/**
 * 광고 자동화(V49) 검증. 매체는 가짜 어댑터로 바꿔 끼운다(실제 당근 호출 없음).
 *
 * <p>지켜야 하는 것:
 * <ol>
 * <li>조건(하루 N건)을 만족해야만, 그리고 <b>하루에 한 번만</b> 동작한다.</li>
 * <li>휴지통 리드는 세지 않는다.</li>
 * <li>매체 실패는 이력·연결 상태로만 남고 예외로 번지지 않는다.</li>
 * <li>남의 리드폼·연결로는 규칙을 만들 수 없다. 연결을 지우면 규칙은 지워지지 않고 일시정지된다.</li>
 * <li>접수 트리거는 엔진이 터져도 절대 예외를 던지지 않는다.</li>
 * </ol>
 */
@SpringBootTest
@Transactional
class AdAutomationTest {

    @MockitoBean
    private AdPlatformClients clients;

    @Autowired
    private AdConnectionService connectionService;
    @Autowired
    private AdConnectionRepository connectionRepository;
    @Autowired
    private AdRuleService ruleService;
    @Autowired
    private AdRuleRepository ruleRepository;
    @Autowired
    private AdRuleEngine engine;
    @Autowired
    private AdActionLogRepository logRepository;
    @Autowired
    private LeadRepository leadRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private final AdPlatformClient karrot = mock(AdPlatformClient.class);
    private User marketer;
    private Form form;
    private Long connectionId;

    @BeforeEach
    void setUp() {
        marketer = user("ad-marketer");
        form = formRepository.save(new Form(marketer.getId(), "치과 상담", FormType.BASIC));

        when(clients.get(AdPlatform.KARROT)).thenReturn(karrot);
        when(clients.supports(AdPlatform.KARROT)).thenReturn(true);
        when(karrot.platform()).thenReturn(AdPlatform.KARROT);
        when(karrot.normalizeCredentials(any())).thenAnswer(inv -> Map.copyOf(inv.getArgument(0)));
        when(karrot.credentialsHint(any())).thenReturn("키 …abcd");
        when(karrot.listAccounts(any())).thenReturn(List.of(new AdPlatformClient.AdAccount("777", "당근 777")));

        connectionId = connectionService.create(marketer.getId(),
                new ConnectionRequest("KARROT", "당근", Map.of("apiKey", "secret-key-abcd", "advertiserId", "777")))
                .id();
    }

    @Test
    @DisplayName("자격증명은 암호문으로만 저장되고 응답에도 원문이 없다")
    void credentialsEncrypted() {
        AdConnection c = connectionRepository.findById(connectionId).orElseThrow();
        assertThat(c.getCredentialsEnc()).startsWith("v1:").doesNotContain("secret-key-abcd");
        assertThat(connectionService.list(marketer.getId()).get(0).toString()).doesNotContain("secret-key-abcd");
    }

    @Test
    @DisplayName("하루 상한에 도달해야 캠페인을 끄고, 같은 날엔 한 번만 끈다")
    void firesOncePerDayWhenLimitReached() {
        createRule(2);

        addLead(null);
        engine.onLeadSubmitted(form.getId());
        verify(karrot, never()).setCampaignActive(any(), anyString(), anyString(), anyBoolean());

        addLead(null);
        engine.onLeadSubmitted(form.getId());
        verify(karrot, times(1)).setCampaignActive(any(), eq("777"), eq("c-1"), eq(false));

        addLead(null);
        engine.onLeadSubmitted(form.getId());
        verify(karrot, times(1)).setCampaignActive(any(), anyString(), anyString(), anyBoolean());

        List<AdActionLog> logs = logRepository.findAll();
        assertThat(logs).hasSize(1);
        assertThat(logs.get(0).isSuccess()).isTrue();
        assertThat(logs.get(0).getTriggerType()).isEqualTo(AdActionLog.Trigger.RULE);
        assertThat(logs.get(0).getAction()).isEqualTo("PAUSE_CAMPAIGN");
    }

    @Test
    @DisplayName("휴지통 리드는 세지 않는다")
    void trashedLeadsNotCounted() {
        createRule(2);
        addLead(null);
        addLead(Instant.now()); // 휴지통
        engine.onLeadSubmitted(form.getId());
        verify(karrot, never()).setCampaignActive(any(), anyString(), anyString(), anyBoolean());
    }

    @Test
    @DisplayName("매체가 키를 거절하면 실패 이력 + 연결 INVALID, 예외는 번지지 않는다")
    void platformFailureIsRecordedNotThrown() {
        createRule(1);
        doThrow(new AdPlatformException(AdPlatformException.Kind.AUTH_INVALID, "키 거절"))
                .when(karrot).setCampaignActive(any(), anyString(), anyString(), anyBoolean());

        addLead(null);
        assertThatCode(() -> engine.onLeadSubmitted(form.getId())).doesNotThrowAnyException();

        AdActionLog log = logRepository.findAll().get(0);
        assertThat(log.isSuccess()).isFalse();
        assertThat(log.getMessage()).contains("키 거절");
        assertThat(connectionRepository.findById(connectionId).orElseThrow().getStatus())
                .isEqualTo(AdConnection.Status.INVALID);
    }

    @Test
    @DisplayName("꺼진 규칙은 동작하지 않는다")
    void disabledRuleDoesNothing() {
        RuleResponse r = createRule(1);
        ruleService.setEnabled(marketer.getId(), r.id(), false);
        addLead(null);
        engine.onLeadSubmitted(form.getId());
        verify(karrot, never()).setCampaignActive(any(), anyString(), anyString(), anyBoolean());
    }

    @Test
    @DisplayName("남의 리드폼·남의 연결로는 규칙을 만들 수 없다")
    void ownershipEnforced() {
        User other = user("ad-other");
        Form otherForm = formRepository.save(new Form(other.getId(), "남의 폼", FormType.BASIC));

        assertThatThrownBy(() -> ruleService.create(marketer.getId(), request(otherForm.getId(), 1, connectionId)))
                .isInstanceOf(InvalidSubmissionException.class);
        assertThatThrownBy(() -> ruleService.create(other.getId(), request(otherForm.getId(), 1, connectionId)))
                .isInstanceOf(InvalidSubmissionException.class);
    }

    @Test
    @DisplayName("연결을 지우면 규칙은 남고 일시정지된다")
    void deletingConnectionPausesRule() {
        RuleResponse r = createRule(1);
        connectionService.delete(marketer.getId(), connectionId);

        var rule = ruleRepository.findById(r.id()).orElseThrow();
        assertThat(rule.getPausedReason()).contains("삭제");
        addLead(null);
        engine.onLeadSubmitted(form.getId());
        verify(karrot, never()).setCampaignActive(any(), anyString(), anyString(), anyBoolean());
    }

    @Test
    @DisplayName("연결 확인에 실패하면 저장하지 않는다")
    void connectionVerifiedBeforeSave() {
        when(karrot.listAccounts(any()))
                .thenThrow(new AdPlatformException(AdPlatformException.Kind.AUTH_INVALID, "키 거절"));
        long before = connectionRepository.count();
        assertThatThrownBy(() -> connectionService.create(marketer.getId(),
                new ConnectionRequest("KARROT", "x", Map.of("apiKey", "bad-key-0000", "advertiserId", "1"))))
                .isInstanceOf(InvalidSubmissionException.class);
        assertThat(connectionRepository.count()).isEqualTo(before);
    }

    @Test
    @DisplayName("접수 트리거는 엔진이 터져도 예외를 던지지 않는다")
    void triggerNeverThrows() {
        AdRuleEngine broken = mock(AdRuleEngine.class);
        doThrow(new IllegalStateException("boom")).when(broken).onLeadSubmitted(any());
        AdAutomationTrigger trigger = new AdAutomationTrigger(broken, true);
        // 테스트 트랜잭션 안 → afterCommit 등록만 된다. 밖이었다면 전용 스레드에서 삼킨다.
        assertThatCode(() -> trigger.onLeadSubmitted(form.getId())).doesNotThrowAnyException();
        assertThatCode(() -> trigger.onLeadSubmitted(null)).doesNotThrowAnyException();

        AdAutomationTrigger off = new AdAutomationTrigger(broken, false);
        off.onLeadSubmitted(form.getId());
        verify(broken, never()).onLeadSubmitted(any());
    }

    // ---------- 도우미 ----------

    private RuleResponse createRule(int limit) {
        return ruleService.create(marketer.getId(), request(form.getId(), limit, connectionId));
    }

    private static RuleRequest request(Long formId, int limit, Long connectionId) {
        return new RuleRequest("하루 상한", formId, true, DailyLeadCountCondition.TYPE, Map.of("limit", limit),
                PauseCampaignsAction.TYPE, Map.of(), true,
                List.of(new RuleTargetDto(connectionId, null, null, "777", "c-1", "치과 캠페인")));
    }

    private void addLead(Instant deletedAt) {
        Lead lead = new Lead();
        lead.setFormId(form.getId());
        lead.setAnswers(List.of());
        lead.setDeletedAt(deletedAt);
        leadRepository.saveAndFlush(lead);
    }

    private User user(String key) {
        User u = new User(key + "@test.local", passwordEncoder.encode("pw12345678"), "마케터", "01000000000");
        u.setSubdomain(key);
        return userRepository.save(u);
    }
}
