package com.leadpot.common.warmup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormType;
import com.leadpot.landing.LandingPage;
import com.leadpot.landing.LandingPageRepository;
import com.leadpot.lead.LeadRepository;
import com.leadpot.sms.MessageLogRepository;

/**
 * 예열(warm-up) 검증.
 *
 * <p><b>이 테스트가 지키는 것</b>
 * <ol>
 * <li>공개 경로를 실제로 태운다 — 각 단계가 <b>기대한 상태코드</b>를 받는다. 경로 오타를 잡는 유일한 장치다
 * ({@code WarmupRunner} 는 예열이 서비스를 막지 않도록 상태코드를 확인만 하고 실패로 처리하지 않는다).</li>
 * <li><b>리드가 남지 않는다</b> — INSERT 는 롤백 트랜잭션 안에서만 실행된다.</li>
 * <li><b>문자·알림이 발송되지 않는다</b> — 예열은 {@code LeadService.submit()} 을 부르지 않으므로
 * {@code NotificationService} 를 아예 타지 않는다. 이게 깨지면 배포마다 고객에게 유령 문자가 나간다.</li>
 * <li>대상이 없으면 조용히 건너뛴다 — 신규 환경에서 기동이 실패하면 안 된다.</li>
 * </ol>
 *
 * <p>⚠️ <b>일부러 {@code @Transactional} 을 쓰지 않는다.</b> 예열이 내부에서 롤백 전용 트랜잭션을 쓰는데,
 * 테스트가 트랜잭션을 감싸면 그 롤백 표시가 <b>테스트 트랜잭션 전체</b>로 번져 이후 단정이 깨진다.
 * 그래서 직접 커밋하고 {@link #tearDown()} 에서 지운다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class WarmupTest {

    @Autowired
    private WarmupRunner runner;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private LandingPageRepository landingRepository;
    @Autowired
    private LeadRepository leadRepository;
    @Autowired
    private MessageLogRepository messageLogRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    @LocalServerPort
    private int port;

    private User owner;
    private Form form;
    private LandingPage landing;

    @BeforeEach
    void setUp() {
        User u = new User("warmup-owner@test.local", passwordEncoder.encode("pw12345678"), "마케터", null);
        u.setSubdomain("warmuptest");
        owner = userRepository.save(u);
        form = formRepository.save(new Form(owner.getId(), "예열 리드폼", FormType.BASIC));
        LandingPage lp = new LandingPage(owner.getId(), "예열 랜딩", "warmup-landing");
        lp.setContent(List.of(Map.of("type", "FORM", "formId", form.getId())));
        lp.setStatus("published");
        landing = landingRepository.save(lp);
    }

    @AfterEach
    void tearDown() {
        // 트랜잭션 롤백에 기대지 않으므로 직접 청소한다(다른 테스트가 이 랜딩을 예열 대상으로 집지 않도록).
        leadRepository.findByFormIdAndDeletedAtIsNullOrderByCreatedAtDesc(form.getId())
                .forEach(leadRepository::delete);
        if (landing != null) {
            landingRepository.deleteById(landing.getId());
        }
        formRepository.deleteById(form.getId());
        userRepository.deleteById(owner.getId());
    }

    @Test
    @DisplayName("공개 경로를 기대한 상태코드로 태운다 (경로 오타 방지)")
    void warmsPublicPathsWithExpectedStatus() {
        WarmupRunner.Summary s = runner.runAll(port);

        assertThat(s.count(WarmupRunner.Outcome.FAILED)).isZero();
        assertThat(statusOf(s, "헬스체크")).isEqualTo(200);
        assertThat(statusOf(s, "공개 랜딩 실시간집계")).isEqualTo(200);
        assertThat(statusOf(s, "공개 랜딩 렌더")).isEqualTo(200);
        assertThat(statusOf(s, "공개 리드폼 조회")).isEqualTo(200);
        // 없는 계정이므로 401 이어야 한다. 200 이면 예열이 실제 계정으로 로그인한 것이다.
        assertThat(statusOf(s, "로그인")).isEqualTo(401);
        assertThat(s.step("리드 제출")).get()
                .extracting(WarmupRunner.StepResult::outcome)
                .isEqualTo(WarmupRunner.Outcome.DONE);
    }

    @Test
    @DisplayName("예열은 리드를 남기지 않는다 (INSERT 는 롤백된다)")
    void leavesNoLead() {
        long before = leadRepository.count();

        runner.runAll(port);

        assertThat(leadRepository.count()).isEqualTo(before);
        assertThat(leadRepository.findAll())
                .noneMatch(l -> WarmupRunner.WARMUP_TAG.equals(l.getGroupTag()))
                .noneMatch(l -> WarmupRunner.FAKE_IP.equals(l.getSubmitterIp()));
    }

    @Test
    @DisplayName("예열은 문자/알림을 발송하지 않는다")
    void sendsNoMessage() {
        long before = messageLogRepository.count();

        runner.runAll(port);

        assertThat(messageLogRepository.count()).isEqualTo(before);
    }

    @Test
    @DisplayName("published 랜딩이 없으면 조용히 건너뛴다")
    void skipsWhenNoPublishedLanding() {
        landingRepository.deleteById(landing.getId());
        landing = null; // tearDown 이 다시 지우지 않도록
        // 다른 테스트가 커밋해 둔 랜딩이 남아 있으면 이 검증은 의미가 없다 → 실패가 아니라 건너뛴다.
        assumeTrue(landingRepository.findFirstByStatusOrderByUpdatedAtDesc("published").isEmpty(),
                "다른 published 랜딩이 남아 있어 건너뜁니다.");

        WarmupRunner.Summary s = runner.runAll(port);

        assertThat(runner.resolveTarget()).isEmpty();
        assertThat(s.count(WarmupRunner.Outcome.FAILED)).isZero();
        assertThat(s.step("공개 경로")).get()
                .extracting(WarmupRunner.StepResult::outcome)
                .isEqualTo(WarmupRunner.Outcome.SKIPPED);
    }

    @Test
    @DisplayName("app.warmup.enabled=false 여도 예열 빈은 존재한다(수동 호출용)")
    void beanExistsWhenDisabled() {
        // 테스트 프로파일은 예열을 끄지만(application.properties), 빈 자체는 있어야 진단·수동 호출이 가능하다.
        assertThat(runner).isNotNull();
    }

    private static int statusOf(WarmupRunner.Summary s, String stepName) {
        return s.step(stepName)
                .orElseThrow(() -> new AssertionError("예열 단계가 없습니다: " + stepName))
                .status();
    }
}
