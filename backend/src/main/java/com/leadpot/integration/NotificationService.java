package com.leadpot.integration;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.leadpot.advertiser.AdvertiserFormGrant;
import com.leadpot.advertiser.AdvertiserFormGrantRepository;
import com.leadpot.auth.Role;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.form.Form;
import com.leadpot.lead.Lead;

import jakarta.annotation.PreDestroy;

/**
 * 새 리드 알림/전송(외부 연동). 텔레그램 봇 메시지 + 구글시트 행 추가(Sheets API).
 * 리드 접수를 절대 방해하지 않도록 <b>커밋 이후 비동기</b>로 보내고 모든 예외를 삼킨다(best-effort).
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private static final DateTimeFormatter DT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZoneId.of("Asia/Seoul"));
    private static final String CHANNEL_TELEGRAM = NotificationLog.CHANNEL_TELEGRAM;
    private static final String CHANNEL_SHEETS = NotificationLog.CHANNEL_SHEETS;

    private final IntegrationSettingsRepository settingsRepository;
    private final AdvertiserFormGrantRepository grantRepository;
    private final UserRepository userRepository;
    private final NotificationLogWriter logWriter;
    private final GoogleSheetsClient sheetsClient;
    private final com.leadpot.sms.LeadSmsPlanner smsPlanner;
    private final com.leadpot.sms.SmsService smsService;
    /** 광고주 알림 메시지의 리드 상세 딥링크에 쓰는 공개 앱 주소(끝 슬래시 없이). */
    private final String publicBaseUrl;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
    private final ExecutorService executor = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "lead-notify");
        t.setDaemon(true);
        return t;
    });

    public NotificationService(IntegrationSettingsRepository settingsRepository,
            AdvertiserFormGrantRepository grantRepository, UserRepository userRepository,
            NotificationLogWriter logWriter,
            GoogleSheetsClient sheetsClient,
            com.leadpot.sms.LeadSmsPlanner smsPlanner,
            com.leadpot.sms.SmsService smsService,
            @Value("${app.public-base-url:https://app.lead-pot.com}") String publicBaseUrl) {
        this.settingsRepository = settingsRepository;
        this.grantRepository = grantRepository;
        this.userRepository = userRepository;
        this.logWriter = logWriter;
        this.sheetsClient = sheetsClient;
        this.smsPlanner = smsPlanner;
        this.smsService = smsService;
        this.publicBaseUrl = trimTrailingSlash(publicBaseUrl);
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
            // 마케터(폼 소유자)에게 갈 채널이 하나라도 있을 때만 중복 판정을 계산한다(광고주 메시지엔 중복 문구가 없다).
            boolean marketerFacing = marketerTelegramActive(form) || sheetsActive(form);
            boolean duplicate = marketerFacing && duplicateCheck != null && duplicateCheck.getAsBoolean();

            // 발송 대상 목록화: 마케터 + 이 폼을 부여받은 광고주. 페이로드까지 트랜잭션 내부에서 스냅샷으로 확정한다.
            List<Dispatch> dispatches = planDispatches(form, lead, duplicate);
            // 문자(마케터·광고주·고객)도 같은 원칙으로 지금 스냅샷을 확정한다 — 커밋 후 스레드는 엔티티를 못 읽는다.
            List<com.leadpot.sms.SmsService.SmsRequest> smsRequests = smsPlanner.plan(form, lead);
            if (dispatches.isEmpty() && smsRequests.isEmpty()) {
                return;
            }

            Long leadId = lead.getId();
            Long formId = form.getId();
            runAfterCommit(() -> {
                for (Dispatch d : dispatches) {
                    String err = CHANNEL_TELEGRAM.equals(d.channel())
                            ? sendTelegram(d.token(), d.chatId(), d.payload())
                            : sendSheets(d.sheetsRow());
                    if (err != null) {
                        log.warn("리드 알림 실패(channel={}, recipient={}): {}", d.channel(), d.recipientUserId(), err);
                    }
                    logWriter.record(leadId, formId, d.recipientUserId(), d.channel(), err);
                }
                // 문자는 자체 이력(message_logs)에 남기므로 여기서 따로 기록하지 않는다.
                for (com.leadpot.sms.SmsService.SmsRequest r : smsRequests) {
                    smsService.send(r);
                }
            });
        } catch (RuntimeException e) {
            // 알림 준비 중 어떤 오류가 나도 리드 접수에는 영향 없어야 한다.
            log.warn("리드 알림 준비 실패(form={}): {}", form.getId(), e.toString());
        }
    }

    /**
     * AS 요청 알림(V30) — 리드에 이의가 접수되면 <b>마케터</b>에게 텔레그램+문자로 알린다.
     * 요청 트랜잭션 안에서 스냅샷을 확정하고 커밋 후 발송한다(접수 실패 시 알림도 안 나간다).
     *
     * <p>사용자는 카카오 알림톡을 원했지만 발송 코드·전용 템플릿 심사가 아직 없다(M7).
     * 채널만 바꾸면 되도록 문구는 채널 중립으로 둔다.
     */
    public void notifyAsRequest(Form form, Lead lead, String reason) {
        try {
            List<Dispatch> dispatches = new ArrayList<>();
            IntegrationSettings owner = settingsRepository.findById(form.getOwnerId()).orElse(null);
            if (telegramReady(owner)) {
                // AS 는 돈이 걸린 분쟁이라 폼별 접수알림 토글(notifyEnabled)과 무관하게 보낸다.
                dispatches.add(new Dispatch(form.getOwnerId(), CHANNEL_TELEGRAM, owner.getTelegramBotToken(),
                        owner.getTelegramChatId(), buildAsRequestText(form, lead, reason), null));
            }
            String smsTo = marketerPhone(form);
            com.leadpot.sms.SmsService.SmsRequest sms = smsTo == null ? null
                    : com.leadpot.sms.SmsService.SmsRequest.to(form.getOwnerId(), smsTo,
                            "[리드팟] '" + nn(form.getName()) + "' 리드에 AS 요청이 접수되었습니다. 리드팟에서 확인해주세요.",
                            com.leadpot.sms.MessageLog.TO_MARKETER)
                            .forLead(form.getId(), lead.getId());
            if (dispatches.isEmpty() && sms == null) {
                return;
            }
            Long leadId = lead.getId();
            Long formId = form.getId();
            runAfterCommit(() -> {
                for (Dispatch d : dispatches) {
                    String err = sendTelegram(d.token(), d.chatId(), d.payload());
                    if (err != null) {
                        log.warn("AS 요청 알림 실패(recipient={}): {}", d.recipientUserId(), err);
                    }
                    logWriter.record(leadId, formId, d.recipientUserId(), d.channel(), err);
                }
                if (sms != null) {
                    smsService.send(sms);
                }
            });
        } catch (RuntimeException e) {
            log.warn("AS 요청 알림 준비 실패(form={}): {}", form.getId(), e.toString());
        }
    }

    private String buildAsRequestText(Form form, Lead lead, String reason) {
        return "⚠️ AS 요청 · " + nn(form.getName()) + "\n"
                + "리드 #" + lead.getId() + " 에 이의가 접수되었습니다.\n"
                + "사유: " + cut(nn(reason), 300) + "\n"
                + "👉 " + publicBaseUrl + "/leads?lead=" + lead.getId();
    }

    /** 마케터 문자 수신번호 — 리드폼 지정(smsMarketerPhone) 우선, 없으면 계정 연락처. */
    private String marketerPhone(Form form) {
        String to = form.getSettingsConfig() == null ? null
                : str(form.getSettingsConfig().get("smsMarketerPhone"));
        if (to == null || to.isBlank()) {
            to = userRepository.findById(form.getOwnerId()).map(User::getPhone).orElse(null);
        }
        return to == null || to.isBlank() ? null : to;
    }

    /**
     * 발송 한 건(채널·수신자·페이로드). 비동기 스레드에 넘길 불변 스냅샷.
     * 텔레그램은 {@code payload}(본문), 구글시트는 {@code sheetsRow} 를 쓴다.
     */
    record Dispatch(Long recipientUserId, String channel, String token, String chatId, String payload,
            SheetsRow sheetsRow) {
    }

    /**
     * 시트에 넣을 한 행. {@code header} 는 <b>시트가 비어 있을 때만</b> 첫 행으로 들어간다
     * (예전 Apps Script 와 같은 동작 — 사용자 확정 2026-08-11).
     */
    record SheetsRow(String spreadsheetId, String tabName, List<Object> header, List<Object> values) {
    }

    /**
     * 이 리드에 대해 실제로 나갈 발송 목록을 만든다(전송은 하지 않음).
     * ① 폼 소유 마케터(텔레그램·구글시트) ② 그 폼을 부여받은 광고주(텔레그램만, 유효 권한·활성 계정·본인 채널).
     * 순수 조회라 테스트에서 대상 선정 로직을 결정적으로 검증할 수 있다.
     */
    List<Dispatch> planDispatches(Form form, Lead lead, boolean duplicate) {
        List<Dispatch> out = new ArrayList<>();

        // ① 마케터 텔레그램 — 계정 채널 + 리드폼별 토글(settingsConfig.notifyEnabled, 기본 on)
        IntegrationSettings owner = settingsRepository.findById(form.getOwnerId()).orElse(null);
        if (formTelegramEnabled(form) && telegramReady(owner)) {
            out.add(new Dispatch(form.getOwnerId(), CHANNEL_TELEGRAM, owner.getTelegramBotToken(),
                    owner.getTelegramChatId(), buildTelegramText(form, lead, duplicate), null));
        }

        // ① 구글시트 — 리드폼별 설정(settingsConfig). 시트 ID 는 서비스 계정이 편집자로 들어간 시트다.
        if (sheetsActive(form)) {
            out.add(new Dispatch(form.getOwnerId(), CHANNEL_SHEETS, null, null, null,
                    buildSheetsRow(form, lead)));
        }

        // ② 광고주 텔레그램 — 유효한 권한 + 활성 광고주 + 본인 계정 채널. 마케터의 폼별 토글과 독립적이다.
        AdvertiserFormGrant grant = grantRepository.findByFormId(form.getId()).orElse(null);
        if (grant != null && grant.isEffective(Instant.now())) {
            User adv = userRepository.findById(grant.getAdvertiserId()).orElse(null);
            if (adv != null && adv.getRole() == Role.ADVERTISER && adv.isActive()) {
                IntegrationSettings advSettings = settingsRepository.findById(adv.getId()).orElse(null);
                if (telegramReady(advSettings)) {
                    out.add(new Dispatch(adv.getId(), CHANNEL_TELEGRAM, advSettings.getTelegramBotToken(),
                            advSettings.getTelegramChatId(), buildAdvertiserTelegramText(grant, form, lead), null));
                }
            }
        }
        return out;
    }

    private boolean marketerTelegramActive(Form form) {
        return formTelegramEnabled(form)
                && telegramReady(settingsRepository.findById(form.getOwnerId()).orElse(null));
    }

    private boolean sheetsActive(Form form) {
        Map<String, Object> fs = form.getSettingsConfig();
        return fs != null && Boolean.TRUE.equals(fs.get("sheetsEnabled"))
                && notBlank(str(fs.get("sheetsSpreadsheetId")));
    }

    private static boolean telegramReady(IntegrationSettings s) {
        return s != null && s.isTelegramEnabled()
                && notBlank(s.getTelegramBotToken()) && notBlank(s.getTelegramChatId());
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

    /** 구글시트에 한 행 추가(Sheets API·서비스 계정). 성공 시 null, 실패 시 사유 문자열. */
    public String sendSheets(SheetsRow row) {
        if (row == null) {
            return "시트 설정이 비어 있습니다.";
        }
        return sheetsClient.appendRow(row.spreadsheetId(), row.tabName(), row.header(), row.values());
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

    /**
     * 광고주용 텔레그램 메시지. 마케터 메시지와 달리:
     * 표시 이름({@code grant.displayName})을 쓰고, IP·UTM 을 넣지 않으며(원래 답변만),
     * 중복 의심 문구를 넣지 않고(마케터 내부 판단이라 광고주에겐 감춘다), 리드 상세 딥링크를 붙인다.
     */
    private String buildAdvertiserTelegramText(AdvertiserFormGrant grant, Form form, Lead lead) {
        String name = grant.getDisplayName() != null && !grant.getDisplayName().isBlank()
                ? grant.getDisplayName()
                : nn(form.getName());
        StringBuilder sb = new StringBuilder();
        sb.append("🔔 새 리드 · ").append(name).append('\n');
        answersMap(lead).forEach((k, v) -> sb.append("• ").append(k).append(": ").append(cut(v, 120)).append('\n'));
        sb.append("🕒 ").append(lead.getCreatedAt() != null ? DT.format(lead.getCreatedAt()) : DT.format(Instant.now()));
        sb.append("\n👉 ").append(publicBaseUrl).append("/client?form=").append(form.getId())
                .append("&lead=").append(lead.getId());
        return sb.toString();
    }

    /**
     * 시트에 넣을 한 행. <b>접수일시 · 리드폼 이름 · 입력 답변</b>만 담는다(2026-08-10 사용자 확정).
     *
     * <p>예전엔 leadId·상태·중복여부·IP·기기·OS·브라우저·유입경로·UTM 까지 함께 보냈다.
     * 시트는 광고주에게 공유되는 경우가 많아 <b>필요 최소한만</b> 내보내는 편이 낫다 —
     * 방문자 정보가 필요하면 리드 상세·CSV 내보내기에서 본다.
     *
     * <p>열 순서는 예전 Apps Script 와 같다: {@code 접수일시 · 리드폼 · 답변…}.
     * 접수일시는 UTC ISO 문자열 대신 <b>한국시간 문자열</b>로 넣는다 —
     * 시트가 날짜로 알아봐서 정렬·필터가 먹는다(USER_ENTERED).
     */
    private SheetsRow buildSheetsRow(Form form, Lead lead) {
        Map<String, Object> fs = form.getSettingsConfig();
        Map<String, String> answers = answersMap(lead);

        List<Object> header = new ArrayList<>(List.of("접수일시", "리드폼"));
        header.addAll(answers.keySet());
        List<Object> values = new ArrayList<>();
        values.add(DT.format(lead.getCreatedAt() != null ? lead.getCreatedAt() : Instant.now()));
        values.add(nn(form.getName()));
        values.addAll(answers.values());

        return new SheetsRow(str(fs.get("sheetsSpreadsheetId")), str(fs.get("sheetsTabName")), header, values);
    }

    /** 구글시트 연동 테스트용 한 행. 실제 전송과 같은 모양이어야 열이 맞는다. */
    public SheetsRow sheetsTestRow(String spreadsheetId, String tabName) {
        return new SheetsRow(spreadsheetId, tabName,
                List.of("접수일시", "리드폼", "테스트"),
                List.of(DT.format(Instant.now()), "Leadpot 연동 테스트", "연결 확인"));
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

    /** 리드폼별 텔레그램 알림 토글. settingsConfig.notifyEnabled 가 false 로 명시된 경우에만 끔(기본 on). */
    private static boolean formTelegramEnabled(Form form) {
        Map<String, Object> settings = form.getSettingsConfig();
        if (settings == null) {
            return true;
        }
        return !Boolean.FALSE.equals(settings.get("notifyEnabled"));
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static String trimTrailingSlash(String s) {
        if (s == null || s.isBlank()) {
            return "";
        }
        String t = s.trim();
        return t.endsWith("/") ? t.substring(0, t.length() - 1) : t;
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
