package com.leadpot.lead.webhook;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

/**
 * 인바운드 웹훅 요청량 제한(리드폼별, 메모리 슬라이딩 윈도). 설정 실수·재전송 폭주에 대비한
 * 방어선이다(META-LEADS-PLAN §4-4) — Railway 단일 인스턴스 전제라 분산 스토어 없이 충분하다.
 */
@Component
public class WebhookRateLimiter {

    private static final long WINDOW_MS = 60_000;
    private static final int MAX_PER_WINDOW = 120;

    private final ConcurrentHashMap<Long, Deque<Long>> hits = new ConcurrentHashMap<>();

    /** true 면 허용(호출 기록됨), false 면 이번 윈도 한도 초과. */
    public boolean allow(Long formId) {
        Deque<Long> deque = hits.computeIfAbsent(formId, k -> new ArrayDeque<>());
        long now = System.currentTimeMillis();
        synchronized (deque) {
            while (!deque.isEmpty() && now - deque.peekFirst() > WINDOW_MS) {
                deque.pollFirst();
            }
            if (deque.size() >= MAX_PER_WINDOW) {
                return false;
            }
            deque.addLast(now);
            return true;
        }
    }
}
