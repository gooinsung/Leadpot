package com.leadpot.common.upload;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/** 로컬/VM 디스크 저장(기본). /uploads/{파일}로 정적 서빙되며 현재 요청 기준 절대 URL 반환. */
@Component
@ConditionalOnProperty(prefix = "app.storage", name = "type", havingValue = "local", matchIfMissing = true)
public class LocalFileStorage implements FileStorage {

    private final Path dir;

    public LocalFileStorage(@Value("${app.uploads.dir}") String dir) {
        this.dir = Paths.get(dir).toAbsolutePath().normalize();
    }

    @Override
    public String store(String filename, byte[] content, String contentType) throws IOException {
        Path target = dir.resolve(filename).normalize();
        // 경로 탈출 방지: 반드시 업로드 디렉터리 하위여야 함
        if (!target.startsWith(dir)) {
            throw new IOException("잘못된 저장 경로입니다.");
        }
        Files.createDirectories(target.getParent()); // 중첩 경로(landing-image/2026/07/24) 생성
        Files.write(target, content);
        return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/uploads/").path(filename).toUriString();
    }
}
