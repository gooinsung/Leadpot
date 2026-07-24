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
        Files.createDirectories(dir);
        Files.write(dir.resolve(filename).normalize(), content);
        return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/uploads/").path(filename).toUriString();
    }
}
