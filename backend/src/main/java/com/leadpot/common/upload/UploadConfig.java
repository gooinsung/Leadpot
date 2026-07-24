package com.leadpot.common.upload;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** 업로드된 파일을 /uploads/** 로 정적 서빙한다(비로그인 접근 — 공개 리드폼/랜딩 이미지). */
@Configuration
public class UploadConfig implements WebMvcConfigurer {

    private final String uploadsDir;

    public UploadConfig(@Value("${app.uploads.dir}") String uploadsDir) {
        this.uploadsDir = uploadsDir;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path dir = Paths.get(uploadsDir).toAbsolutePath().normalize();
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(dir.toUri().toString())
                // 업로드 파일명이 UUID(불변)라 장기 캐싱
                .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable());
    }
}
