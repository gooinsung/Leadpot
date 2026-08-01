package com.leadpot.sms;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 발송 이력을 <b>별도 트랜잭션(REQUIRES_NEW)</b>으로 커밋하는 전용 빈.
 * 발송은 리드 제출 트랜잭션 커밋 <b>이후 비동기 스레드</b>에서 일어나므로 여기서 자체 트랜잭션을 연다.
 * 이력 저장 실패가 발송 흐름을 깨지 않도록 예외를 삼킨다.
 * (자기호출로는 프록시를 안 거쳐 propagation 이 무시되므로 반드시 별도 빈으로 둔다 —
 * {@code NotificationLogWriter} 와 같은 이유.)
 */
@Service
public class MessageLogWriter {

    private static final Logger log = LoggerFactory.getLogger(MessageLogWriter.class);

    private final MessageLogRepository repository;

    MessageLogWriter(MessageLogRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public MessageLog write(MessageLog entry) {
        return repository.save(entry);
    }

    /** 이력 저장. 실패해도 발송 자체에는 영향을 주지 않는다. */
    public void record(MessageLog entry) {
        try {
            write(entry);
        } catch (RuntimeException e) {
            log.warn("발송 이력 저장 실패(owner={}, status={}): {}",
                    entry.getOwnerId(), entry.getStatus(), e.toString());
        }
    }
}
