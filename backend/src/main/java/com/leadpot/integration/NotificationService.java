package com.leadpot.integration;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
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

import com.leadpot.form.Form;
import com.leadpot.lead.Lead;

import jakarta.annotation.PreDestroy;

/**
 * 새 리드 알림/전송(외부 연동). 텔레그램 봇 메시지 + 구글시트 Apps Script 웹훅 POST.
 * 리드 접수를 절대 방해하지 않도록 <b>커밋 이후 비동기</b>로 보내고 모든 예외를 삼킨다(best-effort).
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private static final DateTimeFormatter DT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZoneId.of("Asia/Seoul"));

    private final IntegrationSettingsRepository settingsRepository;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NORMAL) // Apps Script 웹앱은 302 리다이렉트를 사용한다
            .build();
    private final ExecutorService executor = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "lead-notify");
        t.setDaemon(true);
        return t;
    });

    public NotificationService(IntegrationSettingsRepository settingsRepository) {
        this.settingsRepository = settingsRepository;
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
    }

    /**
     * 새 리드 접수 시 호출(제출 트랜잭션 내부). 발송에 필요한 값을 지금 스냅샷으로 만들고,
     * 트랜잭션 커밋 후에 실제 HTTP 발송을 비동기로 수행한다. 커밋되지 않으면 발송하지 않는다.
     */
    public void notifyNewLead(Form form, Lead lead, java.util.function.BooleanSupplier duplicateCheck) {
        try {
            if (!formNotifyEnabled(form)) {
                return;
            }
            IntegrationSettings s = settingsRepository.findById(form.getOwnerId()).orElse(null);
            if (s == null) {
                return;
            }
            boolean telegram = s.isTelegramEnabled()
                    && notBlank(s.getTelegramBotToken()) && notBlank(s.getTelegramChatId());
            boolean sheets = s.isSheetsEnabled() && notBlank(s.getSheetsWebhookUrl());
            if (!telegram && !sheets) {
                return;
            }

            // 중복 판정은 실제 발송이 필요한 경우에만 계산(불필요한 리드 조회 방지).
            boolean duplicate = duplicateCheck != null && duplicateCheck.getAsBoolean();

            // 발송 페이로드를 트랜잭션 내부에서 스냅샷으로 확정(비동기 스레드에서 엔티티를 만지지 않도록).
            String telegramText = telegram ? buildTelegramText(form, lead, duplicate) : null;
            String sheetsBody = sheets ? buildSheetsBody(form, lead, duplicate, s.getSheetsSecret()) : null;
            String token = s.getTelegramBotToken();
            String chatId = s.getTelegramChatId();
            String webhookUrl = s.getSheetsWebhookUrl();

            Runnable send = () -> {
                if (telegramText != null) {
                    String err = sendTelegram(token, chatId, telegramText);
                    if (err != null) {
                        log.warn("텔레그램 리드 알림 실패(owner={}): {}", form.getOwnerId(), err);
                    }
                }
                if (sheetsBody != null) {
                    String err = sendSheets(webhookUrl, sheetsBody);
                    if (err != null) {
                        log.warn("구글시트 전송 실패(owner={}): {}", form.getOwnerId(), err);
                    }
                }
            };
            runAfterCommit(send);
        } catch (RuntimeException e) {
            // 알림 준비 중 어떤 오류가 나도 리드 접수에는 영향 없어야 한다.
            log.warn("리드 알림 준비 실패(form={}): {}", form.getId(), e.toString());
        }
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
                log.warn("리드 알림 발송 중 오류: {}", e.toString());
            }
        };
    }

    // ---------- 동기 발송(테스트 엔드포인트에서도 재사용) ----------

    /** 텔레그램 sendMessage. 성공 시 null, 실패 시 사유 문자열. */
    public String sendTelegram(String token, String chatId, String text) {
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("chat_id", chatId);
            body.put("text", text);
            String json = toJson(body);
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.telegram.org/bot" + token.trim() + "/sendMessage"))
                    .timeout(Duration.ofSeconds(8))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() / 100 == 2) {
                return null;
            }
            return "HTTP " + res.statusCode() + " " + cut(res.body(), 200);
        } catch (Exception e) {
            return e.getClass().getSimpleName() + ": " + e.getMessage();
        }
    }

    /** 구글시트 Apps Script 웹훅으로 JSON POST. 성공 시 null, 실패 시 사유 문자열. */
    public String sendSheets(String url, String jsonBody) {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url.trim()))
                    .timeout(Duration.ofSeconds(8))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() / 100 == 2) {
                return null;
            }
            return "HTTP " + res.statusCode() + " " + cut(res.body(), 200);
        } catch (Exception e) {
            return e.getClass().getSimpleName() + ": " + e.getMessage();
        }
    }

    // ---------- 메시지/페이로드 구성 ----------

    private String buildTelegramText(Form form, Lead lead, boolean duplicate) {
        StringBuilder sb = new StringBuilder();
        sb.append("🔔 새 리드 · ").append(nn(form.getName())).append('\n');
        if (duplicate) {
            sb.append("⚠️ 중복 의심 (동일 정보로 접수 이력 있음)\n");
        }
        answersMap(lead).forEach((k, v) -> sb.append("• ").append(k).append(": ").append(cut(v, 120)).append('\n'));
        sb.append("🕒 ").append(lead.getCreatedAt() != null ? DT.format(lead.getCreatedAt()) : DT.format(Instant.now()));
        return sb.toString();
    }

    private String buildSheetsBody(Form form, Lead lead, boolean duplicate, String secret) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", "new_lead");
        if (secret != null && !secret.isBlank()) {
            payload.put("secret", secret);
        }
        payload.put("formId", form.getId());
        payload.put("formName", nn(form.getName()));
        payload.put("leadId", lead.getId());
        payload.put("status", nn(lead.getStatus()));
        payload.put("duplicate", duplicate);
        payload.put("createdAt", (lead.getCreatedAt() != null ? lead.getCreatedAt() : Instant.now()).toString());
        payload.put("answers", answersMap(lead));
        payload.put("ip", nn(lead.getSubmitterIp()));
        payload.put("device", nn(lead.getDevice()));
        payload.put("os", nn(lead.getOs()));
        payload.put("browser", nn(lead.getBrowser()));
        payload.put("referer", nn(lead.getReferer()));
        payload.put("utm", lead.getUtm() == null ? Map.of() : lead.getUtm());
        return toJson(payload);
    }

    /** 구글시트 연동 테스트용 본문(시크릿 포함). */
    public String sheetsTestBody(String secret) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", "test");
        if (secret != null && !secret.isBlank()) {
            payload.put("secret", secret);
        }
        payload.put("formName", "Leadpot 연동 테스트");
        Map<String, Object> answers = new LinkedHashMap<>();
        answers.put("테스트", "연결 확인");
        payload.put("answers", answers);
        return toJson(payload);
    }

    // ---------- 소형 JSON 직렬화(의존성 없이) ----------
    // Map / String / Number / Boolean / null 지원. 페이로드가 단순(플랫/1단계 중첩 맵)해서 충분하다.

    @SuppressWarnings("unchecked")
    private static String toJson(Object o) {
        StringBuilder sb = new StringBuilder();
        writeJson(sb, o);
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private static void writeJson(StringBuilder sb, Object o) {
        if (o == null) {
            sb.append("null");
        } else if (o instanceof Map<?, ?> map) {
            sb.append('{');
            boolean first = true;
            for (Map.Entry<?, ?> e : map.entrySet()) {
                if (!first) {
                    sb.append(',');
                }
                first = false;
                writeString(sb, String.valueOf(e.getKey()));
                sb.append(':');
                writeJson(sb, e.getValue());
            }
            sb.append('}');
        } else if (o instanceof Number || o instanceof Boolean) {
            sb.append(o);
        } else {
            writeString(sb, o.toString());
        }
    }

    private static void writeString(StringBuilder sb, String s) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        sb.append('"');
    }

    /** answers(JSONB) → label:value 순서맵. */
    private static Map<String, String> answersMap(Lead lead) {
        Map<String, String> out = new LinkedHashMap<>();
        List<Map<String, Object>> answers = lead.getAnswers();
        if (answers != null) {
            for (Map<String, Object> a : answers) {
                String label = str(a.get("label"));
                String value = str(a.get("value"));
                if (!label.isBlank()) {
                    out.put(label, value);
                }
            }
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private static boolean formNotifyEnabled(Form form) {
        Map<String, Object> settings = form.getSettingsConfig();
        if (settings == null) {
            return true; // 기본값: 알림 켜짐
        }
        Object v = settings.get("notifyEnabled");
        return !Boolean.FALSE.equals(v); // false 로 명시된 경우에만 끔
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
