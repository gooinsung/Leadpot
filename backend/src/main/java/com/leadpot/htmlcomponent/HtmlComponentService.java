package com.leadpot.htmlcomponent;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.common.error.NotFoundException;
import com.leadpot.htmlcomponent.dto.HtmlComponentRequest;
import com.leadpot.htmlcomponent.dto.HtmlComponentResponse;
import com.leadpot.htmlcomponent.dto.HtmlComponentSummary;

/** 재사용 HTML 요소 CRUD(M8). 모든 조회/수정은 소유자(ownerId) 기준으로 제한(K5). */
@Service
public class HtmlComponentService {

    private final HtmlComponentRepository repository;

    public HtmlComponentService(HtmlComponentRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<HtmlComponentSummary> list(Long ownerId) {
        return repository.findByOwnerIdOrderByUpdatedAtDesc(ownerId)
                .stream().map(HtmlComponentSummary::from).toList();
    }

    @Transactional(readOnly = true)
    public HtmlComponentResponse get(Long ownerId, Long id) {
        return HtmlComponentResponse.from(loadOwned(ownerId, id));
    }

    @Transactional
    public HtmlComponentResponse create(Long ownerId, HtmlComponentRequest req) {
        HtmlComponent c = new HtmlComponent(ownerId, req.name().trim(), req.category(), req.html());
        repository.save(c);
        return HtmlComponentResponse.from(c);
    }

    @Transactional
    public HtmlComponentResponse update(Long ownerId, Long id, HtmlComponentRequest req) {
        HtmlComponent c = loadOwned(ownerId, id);
        c.setName(req.name().trim());
        c.setCategory(req.category());
        c.setHtml(req.html());
        return HtmlComponentResponse.from(c);
    }

    @Transactional
    public void delete(Long ownerId, Long id) {
        repository.delete(loadOwned(ownerId, id));
    }

    private HtmlComponent loadOwned(Long ownerId, Long id) {
        return repository.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new NotFoundException("HTML 요소를 찾을 수 없습니다."));
    }
}
