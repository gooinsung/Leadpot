package com.leadpot.common.upload;

import java.io.IOException;
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

    private final FileStorage storage;

    public UploadController(FileStorage storage) {
        this.storage = storage;
    }

    @PostMapping
    public ResponseEntity<Map<String, String>> upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new InvalidSubmissionException("파일이 비어 있습니다.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED.contains(contentType)) {
            throw new InvalidSubmissionException("이미지 파일만 업로드할 수 있습니다.(jpg/png/gif/webp/svg)");
        }
        String filename = UUID.randomUUID().toString().replace("-", "") + "." + EXT.getOrDefault(contentType, "bin");
        String url = storage.store(filename, file.getBytes(), contentType);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("url", url));
    }
}
