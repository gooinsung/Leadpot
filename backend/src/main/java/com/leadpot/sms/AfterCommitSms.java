package com.leadpot.sms;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import jakarta.annotation.PreDestroy;

/**
 * 트랜잭션 커밋 후 문자 발송 — 상태 변경 트리거(잔액 부족·AS 요청 등)용.
 *
 * <p>발송은 외부 HTTP 라 <b>트랜잭션 안에서 하면 안 되고</b>(커넥션 점유·롤백돼도 발송됨),
 * afterCommit 을 요청 스레드에서 그대로 돌리면 응답이 10초까지 막힐 수 있어 전용 스레드로 넘긴다.
 * NotificationService(신규 접수 알림)와 같은 원칙이다 — 그쪽은 텔레그램·시트까지 묶여 있어
 * 문자만 필요한 호출부를 위해 이 작은 컴포넌트를 따로 뒀다.
 *
 * <p>요청은 커밋 <b>전에</b> 불변 스냅샷({@link SmsService.SmsRequest})으로 확정해서 넘겨야 한다 —
 * 커밋 후 스레드는 엔티티를 읽을 수 없다.
 */
@Component
public class AfterCommitSms {

    private static final Logger log = LoggerFactory.getLogger(AfterCommitSms.class);

    private final SmsService smsService;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "after-commit-sms");
        t.setDaemon(true);
        return t;
    });

    public AfterCommitSms(SmsService smsService) {
        this.smsService = smsService;
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
    }

    /** 커밋되면 보낸다(롤백되면 안 보낸다). 트랜잭션 밖에서 불리면 바로 백그라운드로 보낸다. */
    public void send(SmsService.SmsRequest request) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    submit(request);
                }
            });
        } else {
            submit(request);
        }
    }

    private void submit(SmsService.SmsRequest request) {
        executor.submit(() -> {
            try {
                smsService.send(request);
            } catch (RuntimeException e) {
                // 발송 실패가 업무 흐름을 깨면 안 된다 — send 자체도 예외를 안 던지지만 이중 방어.
                log.warn("커밋 후 문자 발송 실패({}): {}", request.recipientType(), e.toString());
            }
        });
    }
}
