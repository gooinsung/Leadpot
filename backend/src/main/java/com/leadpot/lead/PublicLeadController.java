package com.leadpot.lead;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.lead.dto.LeadSubmitRequest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

/** 공개 리드폼 제출 수신(비로그인). 방문자 정보를 헤더에서 추출해 함께 저장. */
@RestController
@RequestMapping("/api/public/leads")
public class PublicLeadController {

    private final LeadService leadService;

    public PublicLeadController(LeadService leadService) {
        this.leadService = leadService;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> submit(@Valid @RequestBody LeadSubmitRequest request,
            HttpServletRequest http) {
        LeadService.Visitor visitor = new LeadService.Visitor(
                clientIp(http),
                http.getHeader("User-Agent"),
                http.getHeader("Referer"),
                http.getHeader("Accept-Language"));
        Long id = leadService.submit(request, visitor);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id, "ok", true));
    }

    /** 프록시(Cloudflare/Nginx) 뒤를 대비해 X-Forwarded-For 우선. */
    private String clientIp(HttpServletRequest http) {
        String xff = http.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return http.getRemoteAddr();
    }
}
