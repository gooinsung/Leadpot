package com.leadpot.lead;

import com.leadpot.common.ClientIp;
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

    /**
     * 공용 헬퍼로 통일. 직접 구현하던 X-Forwarded-For 첫 값 방식은 방문자가 위조할 수 있어
     * IP 차단·중복 제출 방지가 뚫렸다({@link ClientIp} 주석 참고).
     */
    private String clientIp(HttpServletRequest http) {
        return ClientIp.of(http);
    }
}
