package com.leadpot.sms;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * ⚠️ <b>임시 API</b> — 운영자 개인 알림용(GPT 예약 작업이 당근마켓 광고를 확인하고 결과를 문자로 보낸다).
 * 잠깐 쓰고 지울 것이므로 이 파일 하나만 지우면 흔적 없이 사라진다(SecurityConfig 의 {@code /api/public/**}
 * 허용에 얹혀 있어 다른 설정을 건드리지 않았다).
 *
 * <pre>
 * POST /api/public/temp-notify-sms
 * {"password": "...", "text": "보낼 문자"}
 * </pre>
 *
 * <p>JWT 없이 암호 하나로만 인증하고, 수신번호는 고정이라 외부에서 다른 번호로 보낼 수 없다.
 * 암호 원문은 저장소에 남기지 않으려고 SHA-256 해시만 둔다. 발송은 기존 시스템 솔라피 키를 그대로 쓴다.
 */
@RestController
@RequestMapping("/api/public/temp-notify-sms")
public class TempNotifySmsController {

    /** 고정 수신번호(운영자 본인). */
    private static final String TO = "01062717059";
    /** 암호의 SHA-256(hex). */
    private static final String PASSWORD_SHA256 =
            "9fa371fe8a722cbf3413402e8ba552967ef9915b3ca323030ab43e2641237b38";
    /** LMS 최대 2,000byte 를 넉넉히 넘지 않도록 글자 수로 자른다(한글 1자 = 2byte). */
    private static final int MAX_TEXT_LENGTH = 1000;

    private final SmsSender smsSender;
    private final SmsService smsService;

    public TempNotifySmsController(SmsSender smsSender, SmsService smsService) {
        this.smsSender = smsSender;
        this.smsService = smsService;
    }

    public record Request(String password, String text) {
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> send(@RequestBody(required = false) Request req) {
        if (req == null || !passwordMatches(req.password())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("ok", false, "error", "암호가 올바르지 않습니다."));
        }
        if (req.text() == null || req.text().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "error", "text 가 비어 있습니다."));
        }
        if (req.text().length() > MAX_TEXT_LENGTH) {
            return ResponseEntity.badRequest()
                    .body(Map.of("ok", false, "error", "text 는 " + MAX_TEXT_LENGTH + "자 이하여야 합니다."));
        }
        SmsSender.SmsResult result = smsSender.send(smsService.resolveCredentials(null, null), TO, req.text());
        if (!result.ok()) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("ok", false, "error", String.valueOf(result.error())));
        }
        return ResponseEntity.ok(Map.of("ok", true, "channel", result.channel()));
    }

    private static boolean passwordMatches(String password) {
        if (password == null) {
            return false;
        }
        try {
            byte[] actual = MessageDigest.getInstance("SHA-256").digest(password.getBytes(StandardCharsets.UTF_8));
            return MessageDigest.isEqual(actual, HexFormat.of().parseHex(PASSWORD_SHA256));
        } catch (NoSuchAlgorithmException e) {
            return false;
        }
    }
}
