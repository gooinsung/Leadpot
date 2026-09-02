package com.leadpot.integration;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.form.Form;
import com.leadpot.lead.Lead;

import jakarta.annotation.PreDestroy;

/**
 * 아웃바운드 웹훅 — 우리 쪽에 리드가 접수되면 <b>외부 URL 로 GET/POST 호출</b>해 전달한다
 * (인바운드 웹훅({@code lead.webhook} 패키지)의 반대 방향).
 *
 * <p>설정은 리드폼별 {@code settingsConfig}(JSONB) 의 {@code outboundWebhook*} 키에 있다
 * (구글시트 연동과 같은 패턴 — 스키마 변경 없이 확장). 결과는 리드 하나당 <b>최신 1건만</b>
 * {@link Lead} 에 남긴다(재시도하면 덮어씀) — 발송 이력 테이블이 아니다.
 *
 * <p>새 리드 접수 시의 발송은 {@link NotificationService}·{@code AfterCommitSms} 와 같은 원칙:
 * 트랜잭션 커밋 <b>이후</b> 전용 스레드에서 best-effort 로 보낸다(제출 응답을 막지 않는다).
 * 마케터가 누르는 '재시도'는 그 자리에서 결과를 봐야 하므로 동기로 호출한다.
 */
@Service
public class OutboundWebhookService {

    private static final Logger log = LoggerFactory.getLogger(OutboundWebhookService.class);
    private static final int MAX_RESPONSE_LEN = 1000;

    private final OutboundWebhookResultWriter resultWriter;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "outbound-webhook");
        t.setDaemon(true);
        return t;
    });

    public OutboundWebhookService(OutboundWebhookResultWriter resultWriter) {
        this.resultWriter = resultWriter;
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
    }

    /** 호출 결과. {@code success} 는 2xx 응답 여부 — 예외(타임아웃 등)도 실패로 취급한다. */
    public record Result(boolean success, Integer code, String body) {
        String status() {
            return success ? "SUCCESS" : "FAILED";
        }
    }

    /**
     * 새 리드 접수 시 호출(제출 트랜잭션 내부). 연동이 꺼져 있으면 아무 일도 하지 않는다.
     * 파라미터는 지금(트랜잭션 안에서) 스냅샷으로 확정한다 — 커밋 후 스레드는 엔티티를 못 읽는다.
     */
    public void dispatchOnLead(Form form, Lead lead) {
        if (!active(form)) {
            return;
        }
        try {
            String url = str(form.getSettingsConfig().get("outboundWebhookUrl"));
            String method = method(form);
            Map<String, String> params = buildParams(form, lead);
            Long leadId = lead.getId();
            runAfterCommit(() -> {
                Result r = call(url, method, params);
                if (!r.success()) {
                    log.warn("아웃바운드 웹훅 실패(lead={}, form={}): HTTP {} {}",
                            leadId, form.getId(), r.code(), cut(r.body(), 200));
                }
                resultWriter.write(leadId, r);
            });
        } catch (RuntimeException e) {
            log.warn("아웃바운드 웹훅 준비 실패(form={}): {}", form.getId(), e.toString());
        }
    }

    /**
     * 마케터가 누른 '재시도' — 동기 호출, 호출한 스레드에서 바로 결과를 돌려준다.
     * 호출부(LeadService)가 이미 활성 트랜잭션 안에 있으므로 결과는 그 트랜잭션에서 lead 에 직접 반영한다.
     */
    public Result retry(Form form, Lead lead) {
        if (!active(form)) {
            throw new InvalidSubmissionException("이 리드폼은 외부 API 전달 연동이 꺼져 있습니다.");
        }
        String url = str(form.getSettingsConfig().get("outboundWebhookUrl"));
        String method = method(form);
        Map<String, String> params = buildParams(form, lead);
        return call(url, method, params);
    }

    private boolean active(Form form) {
        Map<String, Object> fs = form.getSettingsConfig();
        return fs != null && Boolean.TRUE.equals(fs.get("outboundWebhookEnabled"))
                && notBlank(str(fs.get("outboundWebhookUrl")));
    }

    private String method(Form form) {
        String m = str(form.getSettingsConfig().get("outboundWebhookMethod"));
        return "POST".equalsIgnoreCase(m) ? "POST" : "GET";
    }

    /**
     * {@code outboundWebhookParams}(파라미터명·값 소스 목록)를 이 리드 값으로 채운다.
     * source: {@code fixed}(고정값) · {@code answer}(varKey 로 답변 찾기) · {@code builtin}(ip·leadId·submittedAt·formName).
     */
    @SuppressWarnings("unchecked")
    private Map<String, String> buildParams(Form form, Lead lead) {
        Map<String, String> out = new LinkedHashMap<>();
        Map<String, Object> fs = form.getSettingsConfig();
        Object raw = fs == null ? null : fs.get("outboundWebhookParams");
        if (!(raw instanceof List<?> list)) {
            return out;
        }
        Map<String, String> answersByVarKey = new LinkedHashMap<>();
        if (lead.getAnswers() != null) {
            for (Map<String, Object> a : lead.getAnswers()) {
                Object vk = a.get("varKey");
                if (vk != null) {
                    answersByVarKey.put(vk.toString(), str(a.get("value")));
                }
            }
        }
        for (Object o : list) {
            if (!(o instanceof Map<?, ?> m)) {
                continue;
            }
            String name = str(m.get("name"));
            if (name.isBlank()) {
                continue;
            }
            String source = str(m.get("source"));
            String value = switch (source) {
                case "answer" -> answersByVarKey.getOrDefault(str(m.get("varKey")), "");
                case "builtin" -> builtinValue(str(m.get("value")), form, lead);
                default -> str(m.get("value")); // fixed
            };
            out.put(name, value);
        }
        return out;
    }

    private String builtinValue(String key, Form form, Lead lead) {
        return switch (key) {
            case "ip" -> nn(lead.getSubmitterIp());
            case "leadId" -> String.valueOf(lead.getId());
            case "submittedAt" -> lead.getCreatedAt() != null ? lead.getCreatedAt().toString() : "";
            case "formName" -> nn(form.getName());
            default -> "";
        };
    }

    private Result call(String url, String method, Map<String, String> params) {
        try {
            String encoded = encode(params);
            HttpRequest.Builder b = HttpRequest.newBuilder().timeout(Duration.ofSeconds(8));
            HttpRequest req;
            if ("POST".equals(method)) {
                req = b.uri(URI.create(url))
                        .header("Content-Type", "application/x-www-form-urlencoded")
                        .POST(HttpRequest.BodyPublishers.ofString(encoded))
                        .build();
            } else {
                String sep = url.contains("?") ? "&" : "?";
                req = b.uri(URI.create(encoded.isEmpty() ? url : url + sep + encoded))
                        .GET()
                        .build();
            }
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            boolean ok = res.statusCode() / 100 == 2;
            return new Result(ok, res.statusCode(), cut(res.body(), MAX_RESPONSE_LEN));
        } catch (Exception e) {
            return new Result(false, null, e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    private static String encode(Map<String, String> params) {
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> e : params.entrySet()) {
            if (sb.length() > 0) {
                sb.append('&');
            }
            sb.append(URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8))
                    .append('=')
                    .append(URLEncoder.encode(nn(e.getValue()), StandardCharsets.UTF_8));
        }
        return sb.toString();
    }

    private void runAfterCommit(Runnable task) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    executor.submit(guarded(task));
                }
            });
        } else {
            executor.submit(guarded(task));
        }
    }

    private Runnable guarded(Runnable task) {
        return () -> {
            try {
                task.run();
            } catch (RuntimeException e) {
                log.warn("아웃바운드 웹훅 발송 중 오류: {}", e.toString());
            }
        };
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static String nn(String s) {
        return s == null ? "" : s;
    }

    private static String str(Object o) {
        return o == null ? "" : o.toString();
    }

    private static String cut(String s, int max) {
        if (s == null) {
            return "";
        }
        return s.length() > max ? s.substring(0, max) + "…" : s;
    }
}
