package com.leadpot.adautomation;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.leadpot.adautomation.run.AdRuleEngine;

import jakarta.annotation.PreDestroy;

/**
 * 리드팟 본체(리드 접수)가 광고 자동화에 대해 아는 <b>유일한</b> 진입점. 설계: docs/AD-AUTOMATION-PLAN.md §5-1.
 *
 * <p>지켜야 하는 것 — "이 기능 때문에 리드 접수가 느려지거나 실패하는 일은 절대 없다":
 * <ul>
 * <li>호출 스레드(접수 트랜잭션)에서는 <b>DB 조회·매체 호출을 전혀 하지 않는다</b>. 커밋 후 작업 예약만 한다.</li>
 * <li>실제 일은 <b>커밋 이후</b>에만 한다 — 롤백된 접수엔 신호도 안 간다.</li>
 * <li>{@code afterCommit} 안의 예외는 스프링이 호출자(접수 요청)에게 그대로 던진다 → 리드는 저장됐는데 방문자에게 500 이
 * 보이는 사고가 난다. 그래서 afterCommit 본문까지 전부 try/catch 로 감싼다.</li>
 * <li>전용 스레드 1개 + 대기열 상한 500. 넘치면 버리고 경고 로그(다음 접수 때 다시 평가되므로 안전).
 * 기존 알림 executor 들과 스레드를 공유하지 않는다.</li>
 * <li>{@code APP_AD_AUTOMATION_ENABLED=false} 면 즉시 무시(운영 중 급히 끌 때).</li>
 * </ul>
 */
@Component
public class AdAutomationTrigger {

    private static final Logger log = LoggerFactory.getLogger(AdAutomationTrigger.class);
    private static final int QUEUE_CAPACITY = 500;

    private final AdRuleEngine engine;
    private final boolean enabled;
    private final ThreadPoolExecutor executor;

    public AdAutomationTrigger(AdRuleEngine engine,
            @Value("${app.ad-automation.enabled:true}") boolean enabled) {
        this.engine = engine;
        this.enabled = enabled;
        this.executor = new ThreadPoolExecutor(1, 1, 0L, TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(QUEUE_CAPACITY), r -> {
                    Thread t = new Thread(r, "ad-automation");
                    t.setDaemon(true);
                    return t;
                }, (r, ex) -> log.warn("[ad-automation] 대기열이 가득 차 접수 신호 1건을 건너뜁니다."));
    }

    public boolean isEnabled() {
        return enabled;
    }

    /**
     * 리드 접수(공개 폼·웹훅) 직후 호출. 절대 예외를 던지지 않는다.
     */
    public void onLeadSubmitted(Long formId) {
        if (!enabled || formId == null) {
            return;
        }
        try {
            Runnable task = () -> {
                try {
                    engine.onLeadSubmitted(formId);
                } catch (Throwable t) { // NOSONAR — 작업 스레드가 죽지 않게 무엇이든 삼킨다
                    log.warn("[ad-automation] 규칙 처리 실패 form={}", formId, t);
                }
            };
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        enqueue(task);
                    }
                });
            } else {
                enqueue(task);
            }
        } catch (RuntimeException e) {
            log.warn("[ad-automation] 접수 신호 예약 실패 form={}", formId, e);
        }
    }

    private void enqueue(Runnable task) {
        try {
            executor.execute(task);
        } catch (RuntimeException e) {
            log.warn("[ad-automation] 작업 예약 실패", e);
        }
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
    }
}
