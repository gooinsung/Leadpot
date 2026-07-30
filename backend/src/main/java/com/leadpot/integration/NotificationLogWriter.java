package com.leadpot.integration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 알림 발송 이력을 <b>별도 트랜잭션(REQUIRES_NEW)</b>으로 커밋하는 전용 빈.
 * <p>
 * 발송은 리드 제출 트랜잭션 커밋 <b>이후 비동기 스레드</b>에서 일어나므로 진행 중인 트랜잭션이 없다.
 * 여기서 자체 트랜잭션을 열어 로그를 남긴다. 로그 저장 실패가 발송 흐름을 깨지 않도록 예외를 삼킨다.
 * (자기호출로는 프록시를 안 거쳐 propagation 이 무시되므로 반드시 별도 빈으로 둔다.)
 */
@Service
class NotificationLogWriter {

    private static final Logger log = LoggerFactory.getLogger(NotificationLogWriter.class);

    private final NotificationLogRepository repository;

    NotificationLogWriter(NotificationLogRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void write(NotificationLog entry) {
        repository.save(entry);
    }

    /** 발송 이력 저장. 실패해도 발송 자체에는 영향을 주지 않는다. */
    void record(Long leadId, Long formId, Long recipientUserId, String channel, String error) {
        try {
            write(new NotificationLog(leadId, formId, recipientUserId, channel, error == null, error));
        } catch (RuntimeException e) {
            log.warn("알림 로그 저장 실패(lead={}, channel={}): {}", leadId, channel, e.toString());
        }
    }
}
