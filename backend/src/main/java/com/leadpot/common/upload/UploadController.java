package com.leadpot.common.upload;

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

/** 이미지 업로드 (로그인 필요). 저장은 FileStorage(로컬/R2)에 위임, 공개 URL 반환. */
@RestController
@RequestMapping("/api/uploads")
public class UploadController {

    private static final Set<String> ALLOWED = Set.of("image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml");
    private static final Map<String, String> EXT = Map.of(
            "image/jpeg", "jpg", "image/png", "png", "image/gif", "gif", "image/webp", "webp", "image/svg+xml", "svg");
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final FileStorage storage;

    public UploadController(FileStorage storage) {
        this.storage = storage;
    }

    @PostMapping
    public ResponseEntity<Map<String, String>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "type", required = false) String type) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new InvalidSubmissionException("파일이 비어 있습니다.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED.contains(contentType)) {
            throw new InvalidSubmissionException("이미지 파일만 업로드할 수 있습니다.(jpg/png/gif/webp/svg)");
        }
        // 목적/날짜 기반 경로로 저장: {type}-image/YYYY/MM/DD/{uuid}.{ext}
        String prefix = sanitizeType(type) + "-image";
        LocalDate now = LocalDate.now(KST);
        String ext = EXT.getOrDefault(contentType, "bin");
        String key = String.format("%s/%04d/%02d/%02d/%s.%s",
                prefix, now.getYear(), now.getMonthValue(), now.getDayOfMonth(),
                UUID.randomUUID().toString().replace("-", ""), ext);
        String url = storage.store(key, file.getBytes(), contentType);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("url", url));
    }

    /** 경로 프리픽스로 안전한 소문자 영숫자/하이픈만 허용, 없으면 landing. */
    private static String sanitizeType(String type) {
        if (type == null) return "landing";
        String s = type.toLowerCase().replaceAll("[^a-z0-9-]", "");
        return s.isBlank() ? "landing" : s;
    }
}
