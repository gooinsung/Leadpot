package com.leadpot.consent;

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

import com.leadpot.consent.dto.ConsentDocumentRequest;
import com.leadpot.consent.dto.ConsentDocumentResponse;
import com.leadpot.consent.dto.ConsentDocumentSummary;

import jakarta.validation.Valid;

/** 동의 문서 관리 API (로그인 필요, 본인 것만 K5). */
@RestController
@RequestMapping("/api/consent-documents")
public class ConsentDocumentController {

    private final ConsentDocumentService service;

    public ConsentDocumentController(ConsentDocumentService service) {
        this.service = service;
    }

    @GetMapping
    public List<ConsentDocumentSummary> list(@AuthenticationPrincipal Jwt jwt) {
        return service.list(userId(jwt));
    }

    @PostMapping
    public ResponseEntity<ConsentDocumentResponse> create(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ConsentDocumentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(userId(jwt), request));
    }

    @GetMapping("/{id}")
    public ConsentDocumentResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return service.get(userId(jwt), id);
    }

    @PutMapping("/{id}")
    public ConsentDocumentResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @Valid @RequestBody ConsentDocumentRequest request) {
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
