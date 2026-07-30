package com.leadpot.advertiser;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 감사 로그를 <b>별도 트랜잭션</b>으로 커밋하는 전용 빈.
 * <p>
 * ⚠️ 별도 빈으로 분리한 이유: {@code REQUIRES_NEW} 는 스프링 프록시를 통해 호출될 때만 적용된다.
 * 같은 클래스 안에서 {@code this.write(...)} 로 부르면(자기호출) 프록시를 거치지 않아
 * 호출자의 트랜잭션에 그대로 참여한다. 로그인은 {@code readOnly} 트랜잭션이라
 * 그 경우 INSERT 가 "cannot execute INSERT in a read-only transaction" 으로 실패하고
 * 트랜잭션이 rollback-only 로 오염돼 <b>로그인 자체가 깨진다</b>(실제로 발생시킨 버그).
 * 따라서 호출은 반드시 빈 경계를 넘어야 한다({@link AdvertiserAuditService} → 이 빈).
 */
@Service
class AdvertiserAuditWriter {

    private final AdvertiserAccessLogRepository repository;

    AdvertiserAuditWriter(AdvertiserAccessLogRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void write(AdvertiserAccessLog entry) {
        repository.save(entry);
    }
}
