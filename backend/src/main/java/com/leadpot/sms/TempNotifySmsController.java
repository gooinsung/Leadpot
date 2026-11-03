package com.leadpot.sms;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
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
 * {"password": "...", "text": "보낼 문자", "imageUrl": "https://...(선택)"}
 * </pre>
 *
 * <p>JWT 없이 암호 하나로만 인증하고, 수신번호는 고정이라 외부에서 다른 번호로 보낼 수 없다.
 * 암호 원문은 저장소에 남기지 않으려고 SHA-256 해시만 둔다. 발송은 기존 시스템 솔라피 키를 그대로 쓴다.
 *
 * <p>이미지를 붙이면 MMS(건당 110원)로 나간다. 이미지는 두 가지로 받는다 — {@code imageUrl}, 또는 GPT 액션이
 * 대화 첨부 파일을 넘길 때 쓰는 {@code openaiFileIdRefs}(각 항목의 {@code download_link}). 서버가 내려받아
 * 리드폼 첨부와 같은 변환({@link SmsImages#toMmsJpeg})으로 JPG·200KB 규격을 맞춘다.
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
    /** 내려받을 원본 이미지 최대 크기. 변환 전 원본이라 넉넉히 둔다. */
    private static final int MAX_IMAGE_DOWNLOAD_BYTES = 15 * 1024 * 1024;

    private final SmsSender smsSender;
    private final SmsService smsService;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    public TempNotifySmsController(SmsSender smsSender, SmsService smsService) {
        this.smsSender = smsSender;
        this.smsService = smsService;
    }

    /**
     * @param imageUrl         첨부 이미지 주소(선택, https)
     * @param openaiFileIdRefs GPT 액션이 넘기는 첨부 파일 목록(선택). 첫 항목만 쓴다
     */
    public record Request(String password, String text, String imageUrl, List<FileRef> openaiFileIdRefs) {
    }

    /** GPT 액션 파일 참조. 필요한 건 {@code download_link} 뿐이다. */
    public record FileRef(String name, String id, String mime_type, String download_link) {
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
        SmsCredentials cred = smsService.resolveCredentials(null, null);

        String imageId = null;
        String imageSource = imageSource(req);
        if (imageSource != null) {
            byte[] jpeg;
            try {
                jpeg = SmsImages.toMmsJpeg(download(imageSource));
            } catch (IllegalArgumentException | IOException e) {
                return ResponseEntity.badRequest()
                        .body(Map.of("ok", false, "error", "이미지를 내려받지 못했습니다. " + e.getMessage()));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return ResponseEntity.badRequest()
                        .body(Map.of("ok", false, "error", "이미지 다운로드가 중단되었습니다."));
            } catch (SmsImages.UnsupportedImageException e) {
                return ResponseEntity.badRequest().body(Map.of("ok", false, "error", e.getMessage()));
            }
            SmsSender.UploadResult upload = smsSender.upload(cred, jpeg, "notify.jpg");
            if (!upload.ok()) {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                        .body(Map.of("ok", false, "error", "첨부 업로드 실패: " + upload.error()));
            }
            imageId = upload.fileId();
        }

        SmsSender.SmsResult result = smsSender.send(cred, TO, req.text(), imageId);
        if (!result.ok()) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("ok", false, "error", String.valueOf(result.error())));
        }
        return ResponseEntity.ok(Map.of("ok", true, "channel", result.channel()));
    }

    /** imageUrl 이 우선, 없으면 GPT 첨부의 첫 다운로드 링크. 둘 다 없으면 null(문자만 발송). */
    private static String imageSource(Request req) {
        if (req.imageUrl() != null && !req.imageUrl().isBlank()) {
            return req.imageUrl().trim();
        }
        if (req.openaiFileIdRefs() != null) {
            for (FileRef ref : req.openaiFileIdRefs()) {
                if (ref != null && ref.download_link() != null && !ref.download_link().isBlank()) {
                    return ref.download_link().trim();
                }
            }
        }
        return null;
    }

    private byte[] download(String url) throws IOException, InterruptedException {
        URI uri = URI.create(url);
        if (!"https".equalsIgnoreCase(uri.getScheme())) {
            throw new IllegalArgumentException("https 주소만 받습니다.");
        }
        HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(20)).GET().build();
        HttpResponse<InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
        try (InputStream body = response.body()) {
            if (response.statusCode() / 100 != 2) {
                throw new IOException("HTTP " + response.statusCode());
            }
            byte[] bytes = body.readNBytes(MAX_IMAGE_DOWNLOAD_BYTES + 1);
            if (bytes.length > MAX_IMAGE_DOWNLOAD_BYTES) {
                throw new IOException("이미지가 너무 큽니다(15MB 초과).");
            }
            return bytes;
        }
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
