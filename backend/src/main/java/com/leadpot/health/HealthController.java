package com.leadpot.health;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Phase 0: 프론트↔백엔드 연결 확인용 헬스 체크.
 * DB 의존 없음 — JDK만으로 실행 가능.
 */
@RestController
@RequestMapping("/api")
public class HealthController {

    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "UP");
        body.put("service", "leadpot-backend");
        body.put("time", OffsetDateTime.now().toString());
        return body;
    }
}
