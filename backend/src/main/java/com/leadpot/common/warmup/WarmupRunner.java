package com.leadpot.common.warmup;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.web.server.servlet.context.ServletWebServerApplicationContext;
import org.springframework.context.ApplicationListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.ipblock.IpBlockService;
import com.leadpot.ipblock.SiteIpBlockService;
import com.leadpot.landing.LandingPage;
import com.leadpot.landing.LandingPageRepository;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;

/**
 * 기동 직후 예열(warm-up) — 공개 경로를 서버가 스스로 한 번씩 밟아 첫 방문자의 대기를 없앤다.
 *
 * <p><b>왜 필요한가</b> (2026-08-04 실측): 컨테이너가 새로 뜬 뒤 공개 랜딩 API 를 <b>그 프로세스에서 처음</b>
 * 호출하면 <b>6.8초</b>가 걸리고 그 뒤로는 0.4~0.8초다. 유휴 문제가 아니라 <b>경로를 처음 탈 때</b>
 * 비용이 몰리는 것이다 — Hibernate 의 엔티티 persister·쿼리 플랜 준비, Jackson 직렬화기 초기화,
 * JIT 미적용 인터프리터 실행. 따라서 커넥션 풀·keepalive 설정으로는 해결되지 않는다.
 * 재발 시점은 <b>컨테이너가 새로 뜰 때마다, 경로마다 각각 1회</b>(배포 · 메모리 부족으로 인한 재시작 · VM 재부팅).
 *
 * <p><b>가장 위험한 건 리드 제출 경로</b>다. 방문자가 광고를 클릭해 폼을 채우고 '제출'을 눌렀는데
 * 그게 그 컨테이너의 첫 제출이면 몇 초를 기다리다 이탈한다.
 *
 * <p><b>구조</b>
 * <ul>
 * <li><b>읽기 경로는 HTTP 자기호출</b>(127.0.0.1) — 이렇게 해야 Tomcat·Security 필터체인·MVC 핸들러 매핑·
 * Jackson 까지 실제로 데워진다. in-process 서비스 호출로는 그 층이 데워지지 않는다.</li>
 * <li><b>리드 INSERT 는 롤백 트랜잭션</b> — {@link #warmLeadSubmit} 주석 참고.</li>
 * <li><b>데몬 스레드에서 비동기</b> — 기동 시간(약 92초)을 더 늘리면 배포 헬스체크가 죽는다.</li>
 * <li>대상이 없으면(신규 환경) 조용히 건너뛴다. <b>어떤 단계가 실패해도 기동에는 영향이 없다.</b></li>
 * </ul>
 *
 * <p><b>⚠️ 데이터를 바꾸지 않는다</b>: 방문 기록({@code /api/public/visits})은 <b>일부러 호출하지 않는다</b>
 * — 통계가 오염된다. 차단 로그도 남기지 않도록 조회 전용 메서드만 부른다.
 */
@Component
public class WarmupRunner implements ApplicationListener<ApplicationReadyEvent> {

    private static final Logger log = LoggerFactory.getLogger(WarmupRunner.class);

    /** 로그 검색용 표시. 배포 반영 확인은 컨테이너 로그에서 이 문자열을 찾으면 된다. */
    private static final String TAG = "[warmup]";

    /**
     * 예열이 쓰는 가짜 방문자 IP. <b>RFC 5737 TEST-NET-1</b> 로, 실제 방문자에게 절대 할당되지 않는다.
     * 실제 IP(127.0.0.1 등)를 쓰면 중복 제출 방지·IP 차단 판정이 진짜 데이터와 얽힐 수 있다.
     */
    static final String FAKE_IP = "192.0.2.1";
    static final String FAKE_UA = "Leadpot-Warmup/1.0";
    /** 예열 리드의 group_tag. 롤백되므로 저장되지 않지만, 남았다면 이 값으로 찾을 수 있다. */
    static final String WARMUP_TAG = "warmup";

    /** HTTP 단계가 아니어서 상태코드가 없음을 뜻한다. */
    private static final int NO_STATUS = 0;
    /** 상태코드를 검사하지 않음. */
    private static final int ANY_STATUS = 0;

    private final LandingPageRepository landingRepository;
    private final UserRepository userRepository;
    private final LeadRepository leadRepository;
    private final IpBlockService ipBlockService;
    private final SiteIpBlockService siteIpBlockService;
    private final PasswordEncoder passwordEncoder;
    private final TransactionTemplate transactionTemplate;
    private final boolean enabled;

    public WarmupRunner(LandingPageRepository landingRepository, UserRepository userRepository,
            LeadRepository leadRepository, IpBlockService ipBlockService,
            SiteIpBlockService siteIpBlockService, PasswordEncoder passwordEncoder,
            TransactionTemplate transactionTemplate,
            @Value("${app.warmup.enabled:true}") boolean enabled) {
        this.landingRepository = landingRepository;
        this.userRepository = userRepository;
        this.leadRepository = leadRepository;
        this.ipBlockService = ipBlockService;
        this.siteIpBlockService = siteIpBlockService;
        this.passwordEncoder = passwordEncoder;
        this.transactionTemplate = transactionTemplate;
        this.enabled = enabled;
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        if (!enabled) {
            log.info("{} 비활성(app.warmup.enabled=false) — 건너뜁니다.", TAG);
            return;
        }
        int port = resolvePort(event);
        Thread t = new Thread(() -> runAll(port), "leadpot-warmup");
        t.setDaemon(true); // 예열이 남아 있어도 종료를 막지 않는다
        t.start();
    }

    /**
     * 실제로 바인딩된 포트. 테스트는 랜덤 포트라 설정값(server.port)을 믿을 수 없다.
     * 웹 컨텍스트가 아니면 0 을 돌려주고, 그 경우 HTTP 단계는 건너뛴다(in-process 단계만 수행).
     */
    private static int resolvePort(ApplicationReadyEvent event) {
        if (event.getApplicationContext() instanceof ServletWebServerApplicationContext ctx
                && ctx.getWebServer() != null) {
            return ctx.getWebServer().getPort();
        }
        return 0;
    }

    // ---------- 결과 모델 ----------

    enum Outcome {
        /** 태웠다. */
        DONE,
        /** 태우려 했으나 오류 — 첫 방문자가 느려질 뿐 기능은 정상. */
        FAILED,
        /** 대상이 없어 건너뜀(신규 환경 등). 오류가 아니다. */
        SKIPPED
    }

    record StepResult(String name, Outcome outcome, int status, long millis) {
    }

    record Summary(List<StepResult> steps, long millis) {
        long count(Outcome o) {
            return steps.stream().filter(s -> s.outcome() == o).count();
        }

        /** 단계 이름으로 결과 찾기(테스트·진단용). */
        Optional<StepResult> step(String name) {
            return steps.stream().filter(s -> s.name().equals(name)).findFirst();
        }
    }

    /** 한 단계의 동작. HTTP 단계는 상태코드를, 그 밖은 {@link #NO_STATUS} 를 돌려준다. */
    private interface StepAction {
        int run();
    }

    private record Step(String name, StepAction action, int expectedStatus) {
    }

    // ---------- 실행 ----------

    /** 전체 예열. 단계별로 실패를 삼키고 요약만 남긴다 — 예열 실패가 서비스에 영향을 주면 안 된다. */
    Summary runAll(int port) {
        long startedAt = System.nanoTime();
        List<StepResult> results = new ArrayList<>();

        // 비밀번호 검증(BCrypt)은 DB 를 타지 않고도 데울 수 있다. 로그인 지연의 실제 원인 중 하나라
        // 별도로 태운다 — 없는 이메일로 로그인 API 를 부르면 사용자 조회 단계에서 끝나 BCrypt 는 실행되지 않는다.
        results.add(run(new Step("BCrypt", this::warmPasswordEncoder, ANY_STATUS)));

        Optional<Target> target = resolveTarget();
        if (target.isEmpty()) {
            results.add(new StepResult("공개 경로", Outcome.SKIPPED, NO_STATUS, 0));
            Summary summary = new Summary(results, ms(startedAt));
            log.info("{} 공개 랜딩(published)이 없어 공개 경로 예열을 건너뜁니다. ({}ms)", TAG, summary.millis());
            return summary;
        }
        Target t = target.get();

        if (port > 0) {
            // ⚠️ try-with-resources 로 닫는다(Java 21+). 필드로 들고 있으면 셀렉터 스레드가 프로세스 내내
            //    남는데, 이 VM 은 가용 메모리가 200MB대라 한 번 쓰고 버리는 게 낫다.
            try (HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(5))
                    .build()) {
                for (Step s : httpSteps("http://127.0.0.1:" + port, t, client)) {
                    results.add(run(s));
                }
            }
        } else {
            log.debug("{} 웹 서버가 없어 HTTP 자기호출 단계를 건너뜁니다.", TAG);
            results.add(new StepResult("HTTP 자기호출", Outcome.SKIPPED, NO_STATUS, 0));
        }

        results.add(run(new Step("리드 제출", () -> warmLeadSubmit(t), ANY_STATUS)));

        Summary summary = new Summary(results, ms(startedAt));
        log.info("{} 완료 — 성공 {} · 실패 {} · 건너뜀 {} ({}ms)", TAG,
                summary.count(Outcome.DONE), summary.count(Outcome.FAILED),
                summary.count(Outcome.SKIPPED), summary.millis());
        return summary;
    }

    private List<Step> httpSteps(String base, Target t, HttpClient client) {
        List<Step> steps = new ArrayList<>();
        // /api/health 는 DB 를 타지 않는다. 필터체인·MVC 기본 경로만 먼저 데운다.
        steps.add(new Step("헬스체크", () -> get(client, base + "/api/health"), 200));
        steps.add(new Step("공개 랜딩 실시간집계",
                () -> get(client, base + "/api/public/landings/" + t.landingId() + "/live"), 200));
        if (t.subdomain() != null && !t.subdomain().isBlank()) {
            steps.add(new Step("공개 랜딩 렌더",
                    () -> get(client, base + "/api/public/sites/" + t.subdomain() + "/" + t.landingId()), 200));
        }
        if (t.formId() != null) {
            steps.add(new Step("공개 리드폼 조회",
                    () -> get(client, base + "/api/public/forms/" + t.formId()), 200));
        }
        // 없는 계정으로 로그인 → 401 이 정상이다(아래 warmLogin 주석 참고).
        steps.add(new Step("로그인", () -> warmLogin(client, base), 401));
        return steps;
    }

    private StepResult run(Step step) {
        long at = System.nanoTime();
        try {
            int status = step.action().run();
            long took = ms(at);
            // ⚠️ 상태코드가 기대와 다르면 그 경로가 아니라 예외 경로를 태운 것이다(경로 오타·대상 삭제 등).
            //    예열은 계속 진행하되, 배포 로그에서 눈에 띄게 남긴다 — 조용히 지나가면 안 데워진 걸 모른다.
            if (step.expectedStatus() != ANY_STATUS && status != step.expectedStatus()) {
                log.warn("{} {} — 기대 {} 인데 {} 응답. 그 경로가 데워지지 않았을 수 있습니다.",
                        TAG, step.name(), step.expectedStatus(), status);
            } else {
                log.debug("{} {} ok ({}ms)", TAG, step.name(), took);
            }
            return new StepResult(step.name(), Outcome.DONE, status, took);
        } catch (SkipException e) {
            log.debug("{} {} 건너뜀 — {}", TAG, step.name(), e.getMessage());
            return new StepResult(step.name(), Outcome.SKIPPED, NO_STATUS, ms(at));
        } catch (RuntimeException e) {
            // 예열 실패는 경고만 남긴다. 첫 방문자가 느려질 뿐 기능은 정상 동작한다.
            log.warn("{} {} 실패 — {}", TAG, step.name(), e.toString());
            return new StepResult(step.name(), Outcome.FAILED, NO_STATUS, ms(at));
        }
    }

    /** 예열 대상을 건너뛸 사유(실패가 아님). */
    private static class SkipException extends RuntimeException {
        SkipException(String message) {
            super(message);
        }
    }

    // ---------- 대상 선정 ----------

    /** 예열이 밟을 대표 대상. 공개 경로가 실제로 쓰는 식별자(서브도메인·랜딩·리드폼)를 모아둔다. */
    record Target(Long landingId, Long ownerId, String subdomain, Long formId) {
    }

    /**
     * published 랜딩 1건과 그 소유자의 서브도메인, 랜딩에 연결된 리드폼 id 를 찾는다.
     * <p>리드폼을 별도 쿼리로 찾지 않고 <b>랜딩 content 의 FORM 블록에서 꺼내는</b> 이유는,
     * 그래야 실제 방문자가 여는 조합(랜딩 → 그 안의 폼)과 같아지기 때문이다.
     */
    Optional<Target> resolveTarget() {
        try {
            Optional<Target> found = transactionTemplate.execute(status -> {
                LandingPage landing = landingRepository
                        .findFirstByStatusOrderByUpdatedAtDesc("published").orElse(null);
                if (landing == null) {
                    return Optional.<Target>empty();
                }
                String subdomain = userRepository.findById(landing.getOwnerId())
                        .map(User::getSubdomain).orElse(null);
                return Optional.of(new Target(landing.getId(), landing.getOwnerId(), subdomain,
                        firstFormId(landing)));
            });
            return found == null ? Optional.empty() : found;
        } catch (RuntimeException e) {
            log.warn("{} 대상 조회 실패 — {}", TAG, e.toString());
            return Optional.empty();
        }
    }

    /** 랜딩 content 의 첫 FORM 블록이 참조하는 리드폼 id. 없으면 null. */
    private static Long firstFormId(LandingPage landing) {
        if (landing.getContent() == null) {
            return null;
        }
        for (Map<String, Object> block : landing.getContent()) {
            if (!"FORM".equals(String.valueOf(block.get("type")))) {
                continue;
            }
            Object v = block.get("formId");
            if (v instanceof Number n) {
                return n.longValue();
            }
            if (v != null) {
                try {
                    return Long.valueOf(v.toString());
                } catch (NumberFormatException ignored) {
                    // 잘못된 값은 무시하고 다음 블록을 본다
                }
            }
        }
        return null;
    }

    // ---------- 단계별 구현 ----------

    /** BCrypt 해시/검증 1회. DB 를 타지 않고 부작용도 없다. */
    private int warmPasswordEncoder() {
        String hash = passwordEncoder.encode("leadpot-warmup");
        passwordEncoder.matches("leadpot-warmup", hash);
        return NO_STATUS;
    }

    /**
     * 로그인 경로. <b>존재하지 않는 이메일</b>로 호출해 401 을 받는다 —
     * 사용자 조회 쿼리·요청 역직렬화·검증·예외 핸들러까지 데워지고 아무것도 바뀌지 않는다.
     * (실패 로그인은 감사 로그를 남기지 않는다 — {@code AuthService.login} 은 성공 후에만 기록한다.)
     */
    private int warmLogin(HttpClient client, String base) {
        return post(client, base + "/api/auth/login",
                "{\"email\":\"warmup@leadpot.invalid\",\"password\":\"leadpot-warmup\"}");
    }

    /**
     * 리드 제출 경로. 제출이 실제로 실행하는 <b>조회 쿼리</b>들을 태우고,
     * 마지막에 <b>INSERT 를 롤백 트랜잭션 안에서</b> 실행해 쓰기 경로까지 데운다.
     *
     * <p><b>⚠️ 왜 {@code LeadService.submit()} 을 그대로 부르지 않는가</b>
     * <ol>
     * <li>submit 은 <b>합성 입력을 거부하도록 설계</b>돼 있다 — 필수 항목·형식 검증, 항목별 중복 불허,
     * 동일 IP 접수 불허를 통과해야 INSERT 에 닿는다. 그중 하나만 걸려도 조용히 예열이 안 된 채
     * "성공"처럼 보인다(가장 나쁜 실패 방식).</li>
     * <li>submit 은 커밋 후 <b>텔레그램·구글시트·문자를 실제로 발송</b>한다. 롤백하면 발송되지 않지만
     * ({@code NotificationService.runAfterCommit} 이 {@code afterCommit} 동기화로 등록한다)
     * <b>트랜잭션 동기화가 없으면 즉시 발송하는 분기가 있다</b> — 예열이 그 분기를 타면
     * 배포마다 고객에게 유령 문자가 나가고 비용이 발생한다. 그 위험을 아예 만들지 않는다.</li>
     * </ol>
     * 그래서 여기서는 알림을 유발하지 않는 층(쿼리 + INSERT)만 직접 태운다.
     *
     * <p><b>⚠️ 다음 사람 주의</b>: 제출 경로에 새 쿼리가 생기면 여기에도 추가해야 예열이 따라간다.
     * 조회 전용 메서드만 부를 것 — {@code recordHit} 류는 {@code REQUIRES_NEW} 라 롤백해도 남는다.
     */
    private int warmLeadSubmit(Target t) {
        if (t.formId() == null) {
            throw new SkipException("랜딩에 연결된 리드폼이 없습니다.");
        }
        // 1) 차단 판정(조회 전용 — 차단 로그를 남기는 recordHit 은 부르지 않는다)
        siteIpBlockService.blockedPattern(t.ownerId(), FAKE_IP);
        ipBlockService.blockedPattern(t.formId(), FAKE_IP);

        // 2) 중복 제출 방지 쿼리. 기준 시각을 '지금'으로 둬서 같은 SQL 을 태우면서도 행은 거의 읽지 않는다
        //    (Instant.EPOCH 를 넘기면 그 리드폼의 리드를 전부 읽어와 예열이 오히려 무거워진다).
        Instant now = Instant.now();
        leadRepository.findByFormIdAndCreatedAtGreaterThanEqualAndDeletedAtIsNull(t.formId(), now);
        leadRepository.existsByFormIdAndSubmitterIpAndCreatedAtGreaterThanEqualAndDeletedAtIsNull(
                t.formId(), FAKE_IP, now);

        // 3) INSERT — 롤백 전용 트랜잭션. flush 로 INSERT 를 실제 DB 까지 보내야 데워진다.
        //    시퀀스 번호는 롤백되지 않아 리드 id 에 구멍이 생기지만 무해하다.
        transactionTemplate.execute(status -> {
            status.setRollbackOnly(); // 커밋하지 않는다 — 예열 리드가 남으면 통계·알림이 오염된다
            leadRepository.save(warmupLead(t.formId()));
            leadRepository.flush();
            return null;
        });
        return NO_STATUS;
    }

    /** 예열용 리드. 실제 제출과 같은 컬럼을 채워 JSONB 변환까지 데운다(저장되지는 않는다). */
    private static Lead warmupLead(Long formId) {
        Lead lead = new Lead();
        lead.setFormId(formId);
        lead.setAnswers(List.of(answer()));
        lead.setConsents(List.of(consent()));
        lead.setUtm(Map.of("utm_source", WARMUP_TAG));
        lead.setStatus("NEW");
        lead.setPhoneVerified(false);
        lead.setGroupTag(WARMUP_TAG);
        lead.setSubmitterIp(FAKE_IP);
        lead.setUserAgent(FAKE_UA);
        lead.setDevice("desktop");
        lead.setOs(WARMUP_TAG);
        lead.setBrowser(WARMUP_TAG);
        lead.setLanguage("ko");
        return lead;
    }

    private static Map<String, Object> answer() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("label", "예열");
        m.put("fieldType", "text");
        m.put("value", WARMUP_TAG);
        return m;
    }

    private static Map<String, Object> consent() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("label", "예열");
        m.put("required", true);
        m.put("agreed", true);
        return m;
    }

    // ---------- HTTP 자기호출 ----------

    private int get(HttpClient client, String url) {
        return send(client, HttpRequest.newBuilder().uri(URI.create(url)).GET());
    }

    private int post(HttpClient client, String url, String json) {
        return send(client, HttpRequest.newBuilder().uri(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json)));
    }

    /** 응답 본문은 읽어서 버린다 — 그래야 직렬화까지 실제로 수행된다. */
    private int send(HttpClient client, HttpRequest.Builder builder) {
        try {
            HttpRequest req = builder
                    .timeout(Duration.ofSeconds(30)) // 첫 요청이 6.8초까지 걸리므로 넉넉하게
                    .header("User-Agent", FAKE_UA)
                    // 이 요청을 진짜 방문자로 착각하지 않게 예약 IP 를 실어 보낸다(ClientIp 가 XFF 를 읽는다).
                    .header("X-Forwarded-For", FAKE_IP)
                    .build();
            return client.send(req, HttpResponse.BodyHandlers.ofString()).statusCode();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("예열 중단", e);
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    private static long ms(long startedAtNanos) {
        return (System.nanoTime() - startedAtNanos) / 1_000_000;
    }
}
