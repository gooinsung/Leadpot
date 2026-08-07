package com.leadpot.advertiser;

import java.io.IOException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.upload.FileStorage;

/**
 * 광고주 증빙 이미지 업로드(V30) — AS 요청에 첨부할 스크린샷 등.
 *
 * <p>기존 {@code /api/uploads} 는 SecurityConfig 가 {@code /api/**}=ROLE_USER 로 좁혀
 * 광고주(ROLE_ADVERTISER)는 403 이라 전용 경로를 둔다. 용도를 AS 증빙으로 못박아
 * 광고주가 임의 파일 저장소로 쓰지 못하게 크기·형식을 더 죈다(이미지 5MB).
 * 통화녹음(mp3 등)은 후속 — v1 은 이미지 전용(2026-08-08 사용자 합의).
 */
@RestController
@RequestMapping("/api/advertiser/uploads")
public class AdvertiserUploadController {

    private static final Set<String> ALLOWED = Set.of("image/jpeg", "image/png", "image/gif", "image/webp");
    private static final Map<String, String> EXT = Map.of(
            "image/jpeg", "jpg", "image/png", "png", "image/gif", "gif", "image/webp", "webp");
    private static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final FileStorage storage;

    public AdvertiserUploadController(FileStorage storage) {
        this.storage = storage;
    }

    @PostMapping
    public ResponseEntity<Map<String, String>> upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new InvalidSubmissionException("파일이 비어 있습니다.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new InvalidSubmissionException("이미지는 5MB 이하만 올릴 수 있습니다.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED.contains(contentType)) {
            throw new InvalidSubmissionException("이미지 파일만 올릴 수 있습니다.(jpg/png/gif/webp)");
        }
        LocalDate now = LocalDate.now(KST);
        String key = String.format("as-evidence/%04d/%02d/%02d/%s.%s",
                now.getYear(), now.getMonthValue(), now.getDayOfMonth(),
                UUID.randomUUID().toString().replace("-", ""), EXT.get(contentType));
        String url = storage.store(key, file.getBytes(), contentType);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("url", url));
    }
}
