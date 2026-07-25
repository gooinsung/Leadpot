package com.leadpot.htmlcomponent;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.htmlcomponent.dto.HtmlComponentRequest;
import com.leadpot.htmlcomponent.dto.HtmlComponentResponse;
import com.leadpot.htmlcomponent.dto.HtmlComponentSummary;

import jakarta.validation.Valid;

/** 재사용 HTML 요소 관리 API (로그인 필요, 본인 것만 K5). */
@RestController
@RequestMapping("/api/html-components")
public class HtmlComponentController {

    private final HtmlComponentService service;

    public HtmlComponentController(HtmlComponentService service) {
        this.service = service;
    }

    @GetMapping
    public List<HtmlComponentSummary> list(@AuthenticationPrincipal Jwt jwt) {
        return service.list(userId(jwt));
    }

    @PostMapping
    public ResponseEntity<HtmlComponentResponse> create(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody HtmlComponentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(userId(jwt), request));
    }

    @GetMapping("/{id}")
    public HtmlComponentResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return service.get(userId(jwt), id);
    }

    @PutMapping("/{id}")
    public HtmlComponentResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @Valid @RequestBody HtmlComponentRequest request) {
        return service.update(userId(jwt), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        service.delete(userId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
