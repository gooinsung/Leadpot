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
 * 자동 승인 기간 실행기 — 리드폼에 설정된 일수가 지난 리드를 <b>완료</b>로 넘긴다.
 *
 * <p><b>동작</b>: 자동 승인이 켜진 리드폼을 찾아, 각 리드폼의 리드 중
 * <ul>
 * <li>휴지통이 아니고,</li>
 * <li>상태가 <b>신규 또는 상담중</b>이고 (불량·이미 완료는 건드리지 않는다),</li>
 * <li>설정을 켠 시각({@code autoApproveSince}) <b>이후</b>에 접수됐고,</li>
 * <li>접수 후 설정한 일수가 지난</li>
 * </ul>
 * 건을 완료로 바꾸고, 리드 이력에 자동 메모(SYSTEM)를 남긴다.
 *
 * <p><b>⚠️ 소급 적용하지 않는다</b> — 설정을 켠 시점 이후 접수분만 대상이다(사용자 결정 2026-08-06).
 * 이 조건을 빼면 기능을 켜는 순간 과거 리드가 대량으로 완료 처리되고 되돌릴 수 없다.
 * 상세는 {@link AutoApproveSettings} 주석.
 *
 * <p><b>⚠️ 광고주 상태({@code advertiserStatus})는 건드리지 않는다.</b> 마케터 상태와 의도적으로
 * 분리된 컬럼이라({@link Lead} 주석) 함께 바꾸면 광고주의 분류를 서버가 덮어쓰게 된다.
 *
 * <p><b>⚠️ 알림을 보내지 않는다.</b> 텔레그램·구글시트·문자는 <b>신규 접수</b> 훅에만 걸려 있고
 * 상태 변경에는 걸려 있지 않다. 자동 승인이 알림을 유발하면 새벽에 수십 건이 나갈 수 있다.
 *
 * <p><b>주기</b>: 기본 매시 10분(KST). 설정 단위가 '일'이라 시간 단위 실행이면 충분하고,
 * 하루 1회보다 경계 지연이 짧다. 끄려면 {@code APP_LEAD_AUTO_APPROVE_ENABLED=false}.
 *
 * <p><b>⚠️ 컨테이너가 여러 대가 되면 손봐야 한다.</b> 지금은 백엔드 컨테이너가 한 대라
 * 스케줄이 겹치지 않는다. 다중화하면 두 대가 같은 리드를 동시에 처리해 <b>같은 자동 메모가
 * 두 번</b> 남을 수 있다(상태는 멱등이라 결과는 같다). 그때는 DB 잠금이나 리더 선출이 필요하다.
 */
@Component
public class LeadAutoApproveRunner {

    private static final Logger log = LoggerFactory.getLogger(LeadAutoApproveRunner.class);

    /** 로그 검색용 표시. 배포 반영 확인은 컨테이너 로그에서 이 문자열을 찾으면 된다. */
    private static final String TAG = "[auto-approve]";

    /** 자동 승인 대상 상태 — 아직 열려 있는 건만. 불량(SPAM)·이미 완료(DONE)는 제외. */
    static final Set<String> TARGET_STATUSES = Set.of("NEW", "IN_PROGRESS");

    private final FormRepository formRepository;
    private final LeadRepository leadRepository;
    private final LeadNoteRepository leadNoteRepository;
    private final TransactionTemplate transactionTemplate;
    private final boolean enabled;

    public LeadAutoApproveRunner(FormRepository formRepository, LeadRepository leadRepository,
            LeadNoteRepository leadNoteRepository, TransactionTemplate transactionTemplate,
            @Value("${app.lead.auto-approve.enabled:true}") boolean enabled) {
        this.formRepository = formRepository;
        this.leadRepository = leadRepository;
        this.leadNoteRepository = leadNoteRepository;
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
                log.info("{} 리드폼 {}개에서 {}건을 완료로 넘겼습니다.", TAG, s.forms(), s.approved());
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

    /** 한 리드폼의 대상 리드를 완료로 넘기고 이력을 남긴다. 처리 건수를 돌려준다. */
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
            String before = lead.getStatus();
            lead.setStatus(LeadService.STATUS_DONE);
            leadNoteRepository.save(new LeadNote(lead.getId(), ownerId, LeadNote.KIND_SYSTEM,
                    noteBody(settings.days(), before)));
        }
        return targets.size();
    }

    /**
     * 자동 메모 문구. 상태 변경 이력({@code "상태 변경: 신규 → 완료"})과 같은 표기를 이어 붙여
     * 사람이 이력 목록에서 무슨 일이 있었는지 한 줄로 알 수 있게 한다.
     */
    static String noteBody(int days, String before) {
        return "설정에 따른 자동 승인 — 접수 후 " + days + "일 경과. 상태 변경: "
                + LeadService.statusLabel(before) + " → " + LeadService.statusLabel(LeadService.STATUS_DONE);
    }
}
