package com.leadpot.lead;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.leadpot.form.AutoApproveSettings;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;

/**
 * 자동 승인 기간 실행기 — 리드폼에 설정된 일수가 지난 리드를 <b>유효</b>로 확정한다(V29 개편).
 *
 * <p><b>동작</b>: 자동 승인이 켜진 리드폼을 찾아, 각 리드폼의 리드 중
 * <ul>
 * <li>휴지통이 아니고,</li>
 * <li>상태가 <b>신규 또는 커스텀(상담중 등 진행 상태)</b>이고 —
 *     유효(이미 확정)·무효(마케터 판정)·AS요청(분쟁 중)은 건드리지 않는다,</li>
 * <li>설정을 켠 시각({@code autoApproveSince}) <b>이후</b>에 접수됐고,</li>
 * <li>접수 후 설정한 일수가 지난</li>
 * </ul>
 * 건을 유효로 바꾸고, 리드 이력에 자동 메모(SYSTEM·공유)를 남긴다.
 *
 * <p><b>💰 유효 확정은 과금 트리거다</b> — {@link LeadStatusService} 를 지나므로 과금 계약이 있는
 * 리드폼이면 광고주 잔액에서 단가가 차감된다. "N일 안에 AS 요청이 없으면 유효로 확정"이라는
 * 계약 흐름 그 자체다.
 *
 * <p><b>⚠️ 소급 적용하지 않는다</b> — 설정을 켠 시점 이후 접수분만 대상이다(사용자 결정 2026-08-06).
 * 이 조건을 빼면 기능을 켜는 순간 과거 리드가 대량으로 유효 처리(=과금)되고 되돌릴 수 없다.
 * 상세는 {@link AutoApproveSettings} 주석.
 *
 * <p><b>⚠️ 접수 알림을 보내지 않는다.</b> 텔레그램·구글시트·신규접수 문자는 접수 훅에만 걸려 있다.
 * 단 유효 확정에 따른 <b>잔액 부족 알림</b>은 과금 규칙의 일부라 나갈 수 있다(하루 1회 억제됨).
 *
 * <p><b>주기</b>: 기본 매시 10분(KST). 설정 단위가 '일'이라 시간 단위 실행이면 충분하고,
 * 하루 1회보다 경계 지연이 짧다. 끄려면 {@code APP_LEAD_AUTO_APPROVE_ENABLED=false}.
 *
 * <p><b>⚠️ 컨테이너가 여러 대가 되면 손봐야 한다.</b> 지금은 백엔드 컨테이너가 한 대라
 * 스케줄이 겹치지 않는다. 다중화하면 두 대가 같은 리드를 동시에 처리할 수 있다 —
 * 이력 중복은 물론 <b>차감이 두 번</b> 날 수 있어 그때는 DB 잠금이나 리더 선출이 필요하다.
 */
@Component
public class LeadAutoApproveRunner {

    private static final Logger log = LoggerFactory.getLogger(LeadAutoApproveRunner.class);

    /** 로그 검색용 표시. 배포 반영 확인은 컨테이너 로그에서 이 문자열을 찾으면 된다. */
    private static final String TAG = "[auto-approve]";

    /** 자동 승인 대상 상태 — 아직 열려 있는 건만(신규·커스텀). 유효·무효·AS요청은 제외. */
    static final Set<String> TARGET_STATUSES = Set.of(LeadStatuses.NEW, LeadStatuses.CUSTOM);

    private final FormRepository formRepository;
    private final LeadRepository leadRepository;
    private final LeadStatusService leadStatusService;
    private final TransactionTemplate transactionTemplate;
    private final boolean enabled;

    public LeadAutoApproveRunner(FormRepository formRepository, LeadRepository leadRepository,
            LeadStatusService leadStatusService, TransactionTemplate transactionTemplate,
            @Value("${app.lead.auto-approve.enabled:true}") boolean enabled) {
        this.formRepository = formRepository;
        this.leadRepository = leadRepository;
        this.leadStatusService = leadStatusService;
        this.transactionTemplate = transactionTemplate;
        this.enabled = enabled;
    }

    /** 처리 결과 요약(로그·테스트용). */
    public record Summary(int forms, int approved) {
    }

    @Scheduled(cron = "${app.lead.auto-approve.cron:0 10 * * * *}", zone = "Asia/Seoul")
    void scheduled() {
        if (!enabled) {
            return;
        }
        try {
            Summary s = runAll(Instant.now());
            // 처리한 게 없으면 로그를 남기지 않는다 — 매시 찍히면 진짜 기록이 묻힌다.
            if (s.approved() > 0) {
                log.info("{} 리드폼 {}개에서 {}건을 유효로 확정했습니다.", TAG, s.forms(), s.approved());
            }
        } catch (RuntimeException e) {
            // 스케줄 예외를 삼키지 않으면 스레드가 죽어 다음 실행이 사라진다.
            log.warn("{} 실행 실패 — {}", TAG, e.toString());
        }
    }

    /**
     * 전체 실행. 리드폼 하나가 실패해도 나머지는 계속 처리한다.
     *
     * <p>리드폼을 전부 읽어 자바에서 걸러내는 이유: 설정이 JSONB 라 조건을 SQL 로 옮기면
     * Postgres 전용 문법({@code settings_config->>'…'})이 필요한데, <b>테스트는 H2 로 돈다</b>
     * (backend/src/test/resources/application.properties). 리드폼 수는 계정당 수십 건 규모라
     * 전량 조회가 문제되지 않는다. 규모가 커지면 별도 컬럼으로 승격해 인덱스를 거는 것이 정석이다.
     */
    public Summary runAll(Instant now) {
        int forms = 0;
        int approved = 0;
        for (Form form : formRepository.findAll()) {
            AutoApproveSettings settings = AutoApproveSettings.from(form.getSettingsConfig());
            if (!settings.active()) {
                continue;
            }
            forms++;
            try {
                // 리드폼 단위 트랜잭션 — 한 건이 실패해도 다른 리드폼의 처리 결과는 남는다.
                Integer n = transactionTemplate.execute(status ->
                        approveForm(form.getId(), form.getOwnerId(), settings, now));
                approved += n == null ? 0 : n;
            } catch (RuntimeException e) {
                log.warn("{} 리드폼 {} 처리 실패 — {}", TAG, form.getId(), e.toString());
            }
        }
        return new Summary(forms, approved);
    }

    /** 한 리드폼의 대상 리드를 유효로 확정하고 이력을 남긴다(과금 포함). 처리 건수를 돌려준다. */
    private int approveForm(Long formId, Long ownerId, AutoApproveSettings settings, Instant now) {
        Instant cutoff = settings.cutoff(now);
        // 기준 시각보다 유예 경계가 이르면 대상이 있을 수 없다 — 쿼리를 아낀다.
        // (설정을 켠 직후에는 항상 이 분기로 빠져나간다)
        if (cutoff.isBefore(settings.since())) {
            return 0;
        }
        List<Lead> targets = leadRepository.findAutoApproveTargets(
                formId, TARGET_STATUSES, settings.since(), cutoff);
        for (Lead lead : targets) {
            // 단일 관문(apply) — 이력(공유)·과금(유효 차감)이 함께 처리된다. actor = 폼 소유 마케터.
            leadStatusService.apply(lead, LeadStatuses.VALID, null, ownerId, noteHead(settings.days()));
        }
        return targets.size();
    }

    /** 자동 메모의 머리 문구. LeadStatusService 가 뒤에 "…: 신규 → 유효"를 이어 붙인다. */
    static String noteHead(int days) {
        return "설정에 따른 자동 승인 — 접수 후 " + days + "일 경과";
    }
}
