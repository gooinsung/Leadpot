package com.leadpot.report;

import java.time.ZonedDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 리드 리포트 문자 실행기(V47) — 매일 09:00(밤사이 리포트)·00:00(어제 하루 리포트), 서울 시각.
 * 끄려면 {@code APP_LEAD_REPORT_ENABLED=false}.
 *
 * <p>정각 실행이 몇 밀리초 일찍 깨어나도 방금 끝난 구간을 집계하도록 기준 시각에 30초를 더한다
 * ({@link LeadReportKind#latestWindow} 는 '가장 최근에 끝난 구간'을 고른다).
 *
 * <p><b>⚠️ 컨테이너가 여러 대가 되면 손봐야 한다.</b> 지금은 백엔드가 한 대라 겹치지 않지만,
 * 다중화하면 같은 리포트가 두 번 나가(=비용 두 배) 리더 선출이나 발송 기록 잠금이 필요하다.
 * ({@code LeadAutoApproveRunner} 와 같은 제약)
 */
@Component
public class LeadReportRunner {

    private static final Logger log = LoggerFactory.getLogger(LeadReportRunner.class);
    private static final String TAG = "[lead-report]";

    private final LeadReportService service;
    private final boolean enabled;

    public LeadReportRunner(LeadReportService service,
            @Value("${app.lead.report.enabled:true}") boolean enabled) {
        this.service = service;
        this.enabled = enabled;
    }

    @Scheduled(cron = "${app.lead.report.morning-cron:0 0 9 * * *}", zone = "Asia/Seoul")
    public void morning() {
        run(LeadReportKind.MORNING);
    }

    @Scheduled(cron = "${app.lead.report.daily-cron:0 0 0 * * *}", zone = "Asia/Seoul")
    public void daily() {
        run(LeadReportKind.DAILY);
    }

    private void run(LeadReportKind kind) {
        if (!enabled) {
            return;
        }
        try {
            LeadReportService.Summary s = service.runAll(kind, ZonedDateTime.now(LeadReportKind.KST).plusSeconds(30));
            log.info("{} {} 대상 {}개 계정 · 발송 {} · 0건이라 건너뜀 {}", TAG, kind, s.accounts(), s.sent(), s.empty());
        } catch (RuntimeException e) {
            log.error("{} {} 실행 실패", TAG, kind, e);
        }
    }
}
