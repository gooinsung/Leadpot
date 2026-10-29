package com.leadpot.quote;

import java.nio.charset.StandardCharsets;
import java.util.List;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.quote.dto.QuoteRequest;
import com.leadpot.quote.dto.QuoteResponse;
import com.leadpot.quote.dto.QuoteStatusRequest;
import com.leadpot.quote.dto.QuoteSummary;

import jakarta.validation.Valid;

/** 견적서 API(마케터 본인 것만). */
@RestController
@RequestMapping("/api/quotes")
public class QuoteController {

    private final QuoteService service;
    private final QuotePdfRenderer pdfRenderer;

    public QuoteController(QuoteService service, QuotePdfRenderer pdfRenderer) {
        this.service = service;
        this.pdfRenderer = pdfRenderer;
    }

    @GetMapping
    public List<QuoteSummary> list(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) Long advertiserProfileId) {
        return service.list(userId(jwt), advertiserProfileId);
    }

    @GetMapping("/{id}")
    public QuoteResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return service.get(userId(jwt), id);
    }

    @PostMapping
    public ResponseEntity<QuoteResponse> create(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody QuoteRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(userId(jwt), request));
    }

    @PutMapping("/{id}")
    public QuoteResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @Valid @RequestBody QuoteRequest request) {
        return service.update(userId(jwt), id, request);
    }

    @PostMapping("/{id}/issue")
    public QuoteResponse issue(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return service.issue(userId(jwt), id);
    }

    @PatchMapping("/{id}/status")
    public QuoteResponse changeStatus(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @Valid @RequestBody QuoteStatusRequest request) {
        return service.changeStatus(userId(jwt), id, request.status());
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<QuoteResponse> duplicate(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.duplicate(userId(jwt), id));
    }

    @PostMapping("/{id}/save-advertiser")
    public QuoteResponse saveAsAdvertiser(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return service.saveAsAdvertiser(userId(jwt), id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        service.delete(userId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> pdf(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        QuoteResponse q = service.loadForPdf(userId(jwt), id);
        byte[] bytes = pdfRenderer.render(q);
        String filename = "견적서_" + q.quoteNo() + "_" + q.recipient().companyName() + ".pdf";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(filename.replaceAll("[\\\\/:*?\"<>|]", "_"), StandardCharsets.UTF_8)
                        .build().toString())
                .body(bytes);
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
