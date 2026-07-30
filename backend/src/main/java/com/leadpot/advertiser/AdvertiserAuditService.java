package com.leadpot.advertiser;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.leadpot.auth.User;

/**
 * 광고주 활동 감사 기록. 로그 저장이 실패해도 <b>본래 동작(로그인·조회 등)을 막지 않는다</b>.
 * <p>
 * 실제 INSERT 는 {@link AdvertiserAuditWriter}(별도 트랜잭션)에 맡기고, 여기서는 예외를 삼킨다.
 * 이 메서드 자체는 트랜잭션을 열지 않는다 — 예외를 잡아도 호출자의 트랜잭션이
 * rollback-only 로 오염되지 않게 하려면 실패한 INSERT 가 <b>다른</b> 트랜잭션에 있어야 한다.
 */
@Service
public class AdvertiserAuditService {

    private static final Logger log = LoggerFactory.getLogger(AdvertiserAuditService.class);

    private final AdvertiserAuditWriter writer;

    public AdvertiserAuditService(AdvertiserAuditWriter writer) {
        this.writer = writer;
    }

    /** 광고주 로그인 기록. 광고주 계정이 아니면 아무 것도 하지 않는다. */
    public void recordLogin(User user, String ip) {
        if (user == null || !user.isAdvertiser()) {
            return;
        }
        record(new AdvertiserAccessLog(user.getId(), user.getEmail(), AdvertiserAccessLog.ACTION_LOGIN, ip));
    }

    /** best-effort 기록. 실패는 서버 로그로만 남긴다. */
    public void record(AdvertiserAccessLog entry) {
        try {
            writer.write(entry);
        } catch (RuntimeException e) {
            log.warn("광고주 감사 로그 저장 실패(advertiser={}, action={}): {}",
                    entry.getAdvertiserId(), entry.getAction(), e.toString());
        }
    }
}
