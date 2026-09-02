package com.leadpot.integration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;

import java.time.Instant;

/**
 * 아웃바운드 웹훅 결과를 <b>별도 트랜잭션(REQUIRES_NEW)</b>으로 리드에 반영한다.
 * 호출은 커밋 후 비동기 스레드에서 일어나므로 진행 중인 트랜잭션이 없다 — {@link NotificationLogWriter} 와 같은 원칙.
 */
@Service
class OutboundWebhookResultWriter {

    private static final Logger log = LoggerFactory.getLogger(OutboundWebhookResultWriter.class);

    private final LeadRepository leadRepository;

    OutboundWebhookResultWriter(LeadRepository leadRepository) {
        this.leadRepository = leadRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void write(Long leadId, OutboundWebhookService.Result result) {
        try {
            leadRepository.findById(leadId).ifPresent(lead -> {
                lead.setOutboundWebhookResult(result.status(), result.code(), result.body(), Instant.now());
                leadRepository.save(lead);
            });
        } catch (RuntimeException e) {
            log.warn("아웃바운드 웹훅 결과 저장 실패(lead={}): {}", leadId, e.toString());
        }
    }
}
