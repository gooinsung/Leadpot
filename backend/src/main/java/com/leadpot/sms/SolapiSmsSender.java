package com.leadpot.sms;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.stereotype.Component;

/**
 * 솔라피(Solapi) 문자 발송.
 *
 * <pre>
 * POST https://api.solapi.com/messages/v4/send
 * Authorization: HMAC-SHA256 apiKey=..., date=&lt;ISO8601&gt;, salt=&lt;랜덤&gt;, signature=&lt;hex&gt;
 *   signature = HMAC_SHA256(apiSecret, date + salt)
 * Body: {"message": {"to": "01012345678", "from": "0212345678", "text": "..."}}
 * </pre>
 *
 * 번호는 하이픈 없이 숫자만 보내야 한다. 90byte(EUC-KR 기준 한글 45자)를 넘으면 대행사가
 * LMS 로 자동 전환하며 단가가 13원 → 29원으로 오른다.
 */
@Component
public class SolapiSmsSender implements SmsSender {

    private static final String SEND_URL = "https://api.solapi.com/messages/v4/send";
    /** SMS 최대 바이트. 넘으면 LMS 로 과금된다. */
    private static final int SMS_MAX_BYTES = 90;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @Override
    public String provider() {
        return "solapi";
    }

    @Override
    public SmsResult send(SmsCredentials cred, String to, String text) {
        String channel = channelOf(text);
        String recipient = PhoneNumbers.normalize(to);
        if (recipient == null) {
            return SmsResult.failed("수신번호 형식이 올바르지 않습니다.", channel);
        }
        String from = PhoneNumbers.normalize(cred.senderPhone());
        if (from == null) {
            return SmsResult.failed("발신번호가 설정되지 않았거나 형식이 올바르지 않습니다.", channel);
        }
        try {
            String body = "{\"message\":{"
                    + "\"to\":" + json(recipient)
                    + ",\"from\":" + json(from)
                    + ",\"text\":" + json(text)
                    + "}}";
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(SEND_URL))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json; charset=utf-8")
                    .header("Authorization", authorization(cred))
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (res.statusCode() / 100 == 2) {
                return SmsResult.sent(extract(res.body(), "messageId"), channel);
            }
            // 대행사 오류 본문에 사유가 담긴다(잔액 부족·미등록 발신번호 등) — 화면에 그대로 보여줘야 조치가 된다.
            return SmsResult.failed("HTTP " + res.statusCode() + " " + cut(res.body(), 300), channel);
        } catch (Exception e) {
            return SmsResult.failed(e.getClass().getSimpleName() + ": " + e.getMessage(), channel);
        }
    }

    /** 본문 길이로 SMS/LMS 판정(과금 구분·화면 표시용). 대행사도 같은 기준으로 전환한다. */
    public static String channelOf(String text) {
        return byteLength(text) > SMS_MAX_BYTES ? "LMS" : "SMS";
    }

    /** EUC-KR 기준 바이트 수(한글 2byte) — 국내 문자 과금 기준이다. */
    public static int byteLength(String text) {
        if (text == null) {
            return 0;
        }
        int n = 0;
        for (int i = 0; i < text.length(); i++) {
            n += text.charAt(i) < 0x80 ? 1 : 2;
        }
        return n;
    }

    private static String authorization(SmsCredentials cred) throws Exception {
        String date = Instant.now().toString();
        String salt = randomSalt();
        String signature = hmacSha256Hex(cred.apiSecret(), date + salt);
        return "HMAC-SHA256 apiKey=" + cred.apiKey().trim()
                + ", date=" + date
                + ", salt=" + salt
                + ", signature=" + signature;
    }

    private static String randomSalt() {
        byte[] buf = new byte[16];
        RANDOM.nextBytes(buf);
        return hex(buf);
    }

    private static String hmacSha256Hex(String secret, String message) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.trim().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return hex(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
    }

    private static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
        }
        return sb.toString();
    }

    /**
     * 응답에서 값 하나만 꺼낸다(예: messageId). 응답을 통째로 쓸 일이 없어 JSON 파서를 들이지 않는다.
     * 못 찾으면 null — 발송 성공 여부는 HTTP 상태로 판단하므로 문제되지 않는다.
     */
    static String extract(String json, String key) {
        if (json == null) {
            return null;
        }
        String needle = "\"" + key + "\"";
        int at = json.indexOf(needle);
        if (at < 0) {
            return null;
        }
        int colon = json.indexOf(':', at + needle.length());
        if (colon < 0) {
            return null;
        }
        int start = colon + 1;
        while (start < json.length() && (json.charAt(start) == ' ' || json.charAt(start) == '"')) {
            start++;
        }
        int end = start;
        while (end < json.length() && "\",}".indexOf(json.charAt(end)) < 0) {
            end++;
        }
        String value = json.substring(start, end).trim();
        return value.isEmpty() || "null".equals(value) ? null : value;
    }

    private static String json(String s) {
        StringBuilder sb = new StringBuilder("\"");
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
        return sb.append('"').toString();
    }

    private static String cut(String s, int max) {
        if (s == null) {
            return "";
        }
        return s.length() > max ? s.substring(0, max) + "…" : s;
    }
}
