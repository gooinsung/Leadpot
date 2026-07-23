package com.leadpot.consent;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.consent.dto.ConsentDocumentResponse;

/** 동의 문서 공개 조회 (비로그인). 폼의 동의 항목 '보기' 링크가 여는 페이지의 데이터. */
@RestController
@RequestMapping("/api/public/consent-documents")
public class PublicConsentDocumentController {

    private final ConsentDocumentService service;

    public PublicConsentDocumentController(ConsentDocumentService service) {
        this.service = service;
    }

    @GetMapping("/{id}")
    public ConsentDocumentResponse get(@PathVariable Long id) {
        return service.getPublic(id);
    }
}
