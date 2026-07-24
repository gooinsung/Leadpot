package com.leadpot.common.upload;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.leadpot.common.error.InvalidSubmissionException;

/** 이미지 업로드 (로그인 필요). 로컬/VM 디스크에 저장하고 공개 URL(/uploads/{파일})을 반환. */
@RestController
@RequestMapping("/api/uploads")
public class UploadController {

    private static final Set<String> ALLOWED = Set.of("image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml");
    private static final Map<String, String> EXT = Map.of(
            "image/jpeg", "jpg", "image/png", "png", "image/gif", "gif", "image/webp", "webp", "image/svg+xml", "svg");

    private final Path uploadsDir;

    public UploadController(@Value("${app.uploads.dir}") String dir) {
        this.uploadsDir = Paths.get(dir).toAbsolutePath().normalize();
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
        Files.createDirectories(uploadsDir);
        String name = UUID.randomUUID().toString().replace("-", "") + "." + EXT.getOrDefault(contentType, "bin");
        Path target = uploadsDir.resolve(name).normalize();
        try (var in = file.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        }
        // 공개 경로 반환(프론트가 API 오리진과 합쳐 절대 URL 로 사용)
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("url", "/uploads/" + name));
    }
}
