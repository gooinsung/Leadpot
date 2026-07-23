package com.leadpot.consent;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.common.error.NotFoundException;
import com.leadpot.consent.dto.ConsentDocumentRequest;
import com.leadpot.consent.dto.ConsentDocumentResponse;
import com.leadpot.consent.dto.ConsentDocumentSummary;

/** 동의 문서 CRUD. 관리(목록/생성/수정/삭제)는 소유자 기준(K5), 단건 내용 조회는 공개용도 제공. */
@Service
public class ConsentDocumentService {

    private final ConsentDocumentRepository repository;

    public ConsentDocumentService(ConsentDocumentRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<ConsentDocumentSummary> list(Long ownerId) {
        return repository.findByOwnerIdOrderByUpdatedAtDesc(ownerId)
                .stream().map(ConsentDocumentSummary::from).toList();
    }

    @Transactional(readOnly = true)
    public ConsentDocumentResponse get(Long ownerId, Long id) {
        return ConsentDocumentResponse.from(loadOwned(ownerId, id));
    }

    /** 공개 조회 — 소유자 검증 없이 id 로 문서 내용을 반환('보기' 링크용). */
    @Transactional(readOnly = true)
    public ConsentDocumentResponse getPublic(Long id) {
        ConsentDocument doc = repository.findById(id)
                .orElseThrow(() -> new NotFoundException("동의 문서를 찾을 수 없습니다."));
        return ConsentDocumentResponse.from(doc);
    }

    @Transactional
    public ConsentDocumentResponse create(Long ownerId, ConsentDocumentRequest req) {
        ConsentDocument doc = new ConsentDocument(ownerId, req.title().trim(), req.content());
        repository.save(doc);
        return ConsentDocumentResponse.from(doc);
    }

    @Transactional
    public ConsentDocumentResponse update(Long ownerId, Long id, ConsentDocumentRequest req) {
        ConsentDocument doc = loadOwned(ownerId, id);
        doc.setTitle(req.title().trim());
        doc.setContent(req.content());
        return ConsentDocumentResponse.from(doc);
    }

    @Transactional
    public void delete(Long ownerId, Long id) {
        repository.delete(loadOwned(ownerId, id));
    }

    private ConsentDocument loadOwned(Long ownerId, Long id) {
        return repository.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new NotFoundException("동의 문서를 찾을 수 없습니다."));
    }
}
