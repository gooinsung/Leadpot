package com.leadpot.form;

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

import com.leadpot.form.dto.FormRequest;
import com.leadpot.form.dto.FormResponse;
import com.leadpot.form.dto.FormSummary;

import jakarta.validation.Valid;

/** 폼 관리 API (로그인 필요). 본인 소유 폼만 접근한다(K5). */
@RestController
@RequestMapping("/api/forms")
public class FormController {

    private final FormService formService;

    public FormController(FormService formService) {
        this.formService = formService;
    }

    @GetMapping
    public List<FormSummary> list(@AuthenticationPrincipal Jwt jwt) {
        return formService.list(userId(jwt));
    }

    @PostMapping
    public ResponseEntity<FormResponse> create(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody FormRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(formService.create(userId(jwt), request));
    }

    @GetMapping("/{id}")
    public FormResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return formService.get(userId(jwt), id);
    }

    @PutMapping("/{id}")
    public FormResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @Valid @RequestBody FormRequest request) {
        return formService.update(userId(jwt), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        formService.delete(userId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
