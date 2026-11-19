package com.leadpot.adautomation.run;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.leadpot.adautomation.rule.AdRule;
import com.leadpot.adautomation.rule.AdRuleRepository;
import com.leadpot.adautomation.rule.AdRuleTarget;
import com.leadpot.adautomation.rule.AdRuleTargetRepository;
import com.leadpot.adautomation.rule.RuleAction;
import com.leadpot.adautomation.rule.RuleCatalog;
import com.leadpot.adautomation.rule.RuleCondition;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;

/**
 * 규칙 엔진: 리드폼에 접수가 들어오면 그 리드폼의 규칙을 평가하고, 조건을 만족하면 동작을 실행한다.
 *
 * <p>흐름(규칙마다): 조건 평가 → <b>기간당 1회 선점</b>(DB UPDATE, 동시 접수에도 한 번만) → 대상 조회 → 동작 실행
 * → 텔레그램 알림. 매체 호출 중엔 트랜잭션·DB 커넥션을 쥐지 않는다(각 단계가 짧은 개별 트랜잭션).
 * 한 규칙의 실패가 다른 규칙을 막지 않는다.
 */
@Component
public class AdRuleEngine {

    private static final Logger log = LoggerFactory.getLogger(AdRuleEngine.class);

    private final AdRuleRepository ruleRepository;
    private final AdRuleTargetRepository targetRepository;
    private final RuleCatalog catalog;
    private final FormRepository formRepository;
    private final AdNotifier notifier;
    private final Clock clock;

    public AdRuleEngine(AdRuleRepository ruleRepository, AdRuleTargetRepository targetRepository,
            RuleCatalog catalog, FormRepository formRepository, AdNotifier notifier) {
        this.ruleRepository = ruleRepository;
        this.targetRepository = targetRepository;
        this.catalog = catalog;
        this.formRepository = formRepository;
        this.notifier = notifier;
        this.clock = Clock.systemUTC();
    }

    /** 접수 신호 처리. 규칙이 없는 리드폼은 조회 1회로 끝난다. */
    public void onLeadSubmitted(Long formId) {
        List<AdRule> rules = ruleRepository.findRunnableByFormId(formId);
        for (AdRule rule : rules) {
            try {
                evaluate(rule);
            } catch (RuntimeException e) {
                log.warn("[ad-automation] 규칙 평가 실패 rule={}", rule.getId(), e);
            }
        }
    }

    void evaluate(AdRule rule) {
        RuleCondition condition = catalog.conditionOrNull(rule.getConditionType());
        RuleAction action = catalog.actionOrNull(rule.getActionType());
        if (condition == null || action == null) {
            log.warn("[ad-automation] 알 수 없는 조건/동작 rule={} {}→{}", rule.getId(), rule.getConditionType(),
                    rule.getActionType());
            return;
        }
        Instant now = clock.instant();
        RuleCondition.Evaluation eval = condition.evaluate(rule, now);
        if (!eval.met()) {
            return;
        }
        if (ruleRepository.claimPeriod(rule.getId(), eval.periodKey(), now) == 0) {
            return; // 이 기간에 이미 발동했다
        }
        List<AdRuleTarget> targets = targetRepository.findByRuleIdOrderByIdAsc(rule.getId());
        List<TargetResult> results = action.execute(rule, targets);
        String formName = formRepository.findById(rule.getFormId()).map(Form::getName).orElse(null);
        log.info("[ad-automation] 규칙 발동 rule={} form={} {} → 대상 {}개, 실패 {}개", rule.getId(),
                rule.getFormId(), eval.summary(), results.size(), results.stream().filter(r -> !r.success()).count());
        notifier.ruleFired(rule, formName, eval.summary(), action.label(), results);
    }
}
