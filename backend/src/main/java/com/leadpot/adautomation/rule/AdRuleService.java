package com.leadpot.adautomation.rule;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.adautomation.connection.AdConnection;
import com.leadpot.adautomation.connection.AdConnectionRepository;
import com.leadpot.adautomation.dto.AdAutomationDtos.RuleRequest;
import com.leadpot.adautomation.dto.AdAutomationDtos.RuleResponse;
import com.leadpot.adautomation.dto.AdAutomationDtos.RuleTargetDto;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;

/** 자동화 규칙 CRUD(마케터 본인 것만). 매체 호출이 없어 일반 트랜잭션으로 둔다. */
@Service
public class AdRuleService {

    static final int MAX_TARGETS = 50;
    static final String FORM_DELETED = "리드폼이 삭제되어 일시정지됨";

    private final AdRuleRepository ruleRepository;
    private final AdRuleTargetRepository targetRepository;
    private final AdConnectionRepository connectionRepository;
    private final FormRepository formRepository;
    private final RuleCatalog catalog;

    public AdRuleService(AdRuleRepository ruleRepository, AdRuleTargetRepository targetRepository,
            AdConnectionRepository connectionRepository, FormRepository formRepository, RuleCatalog catalog) {
        this.ruleRepository = ruleRepository;
        this.targetRepository = targetRepository;
        this.connectionRepository = connectionRepository;
        this.formRepository = formRepository;
        this.catalog = catalog;
    }

    /** 목록. 리드폼이 삭제된 규칙은 여기서 발견해 일시정지 사유를 새긴다(결정: 지우지 않고 표시). */
    @Transactional
    public List<RuleResponse> list(Long ownerId) {
        List<AdRule> rules = ruleRepository.findByOwnerIdOrderByIdDesc(ownerId);
        if (rules.isEmpty()) {
            return List.of();
        }
        Map<Long, String> formNames = new LinkedHashMap<>();
        for (Long formId : rules.stream().map(AdRule::getFormId).collect(Collectors.toSet())) {
            formRepository.findByIdAndOwnerId(formId, ownerId).ifPresent(f -> formNames.put(formId, f.getName()));
        }
        Map<Long, List<AdRuleTarget>> targets = targetRepository
                .findByRuleIdIn(rules.stream().map(AdRule::getId).toList()).stream()
                .collect(Collectors.groupingBy(AdRuleTarget::getRuleId));
        Map<Long, AdConnection> conns = connectionMap(ownerId);
        List<RuleResponse> out = new ArrayList<>();
        for (AdRule r : rules) {
            if (!formNames.containsKey(r.getFormId()) && r.getPausedReason() == null) {
                r.setPausedReason(FORM_DELETED);
            }
            out.add(toResponse(r, formNames.get(r.getFormId()), targets.getOrDefault(r.getId(), List.of()), conns));
        }
        return out;
    }

    @Transactional
    public RuleResponse create(Long ownerId, RuleRequest req) {
        AdRule rule = new AdRule(ownerId);
        apply(rule, ownerId, req);
        ruleRepository.save(rule);
        return saveTargets(rule, ownerId, req.targets());
    }

    @Transactional
    public RuleResponse update(Long ownerId, Long id, RuleRequest req) {
        AdRule rule = load(ownerId, id);
        String beforeType = rule.getConditionType();
        Map<String, Object> beforeConfig = rule.getConditionConfig();
        Long beforeForm = rule.getFormId();
        apply(rule, ownerId, req);
        if (!Objects.equals(beforeType, rule.getConditionType())
                || !Objects.equals(beforeConfig, rule.getConditionConfig())
                || !Objects.equals(beforeForm, rule.getFormId())) {
            rule.resetFiring();
        }
        // 다시 저장했다 = 마케터가 대상을 확인했다 → 자동 일시정지를 푼다(리드폼은 apply 에서 검증됨).
        rule.setPausedReason(null);
        targetRepository.deleteByRuleId(rule.getId());
        targetRepository.flush();
        return saveTargets(rule, ownerId, req.targets());
    }

    @Transactional
    public RuleResponse setEnabled(Long ownerId, Long id, boolean enabled) {
        AdRule rule = load(ownerId, id);
        rule.setEnabled(enabled);
        String formName = formRepository.findByIdAndOwnerId(rule.getFormId(), ownerId).map(Form::getName)
                .orElse(null);
        return toResponse(rule, formName, targetRepository.findByRuleIdOrderByIdAsc(id), connectionMap(ownerId));
    }

    @Transactional
    public void delete(Long ownerId, Long id) {
        AdRule rule = load(ownerId, id);
        targetRepository.deleteByRuleId(id);
        ruleRepository.delete(rule);
    }

    // ---------- 내부 ----------

    private void apply(AdRule rule, Long ownerId, RuleRequest req) {
        String name = req.name() == null ? "" : req.name().trim();
        if (name.isEmpty() || name.length() > 100) {
            throw new InvalidSubmissionException("규칙 이름을 1~100자로 입력해주세요.");
        }
        if (req.formId() == null || formRepository.findByIdAndOwnerId(req.formId(), ownerId).isEmpty()) {
            throw new InvalidSubmissionException("리드폼을 선택해주세요.");
        }
        RuleCondition condition = catalog.condition(req.conditionType());
        RuleAction action = catalog.action(req.actionType());
        rule.setName(name);
        rule.setFormId(req.formId());
        rule.setConditionType(condition.type());
        rule.setConditionConfig(new LinkedHashMap<>(condition.normalize(req.conditionConfig())));
        rule.setActionType(action.type());
        rule.setActionConfig(new LinkedHashMap<>(action.normalize(req.actionConfig())));
        if (req.enabled() != null) {
            rule.setEnabled(req.enabled());
        }
        if (req.notifySuccess() != null) {
            rule.setNotifySuccess(req.notifySuccess());
        }
    }

    private RuleResponse saveTargets(AdRule rule, Long ownerId, List<RuleTargetDto> raw) {
        List<RuleTargetDto> list = raw == null ? List.of() : raw;
        if (list.isEmpty()) {
            throw new InvalidSubmissionException("대상 캠페인을 1개 이상 골라주세요.");
        }
        if (list.size() > MAX_TARGETS) {
            throw new InvalidSubmissionException("대상 캠페인은 최대 " + MAX_TARGETS + "개까지 고를 수 있습니다.");
        }
        Map<Long, AdConnection> conns = connectionMap(ownerId);
        Set<String> seen = new HashSet<>();
        List<AdRuleTarget> saved = new ArrayList<>();
        for (RuleTargetDto t : list) {
            if (t == null || t.connectionId() == null || !conns.containsKey(t.connectionId())) {
                throw new InvalidSubmissionException("매체 연결을 다시 골라주세요.");
            }
            String account = clean(t.accountId(), 64);
            String campaign = clean(t.campaignId(), 64);
            if (account == null || campaign == null) {
                throw new InvalidSubmissionException("대상 캠페인 정보가 올바르지 않습니다.");
            }
            if (!seen.add(t.connectionId() + "|" + account + "|" + campaign)) {
                continue;
            }
            String name = clean(t.campaignName(), 300);
            saved.add(targetRepository.save(new AdRuleTarget(rule.getId(), t.connectionId(), account, campaign,
                    name == null ? campaign : name)));
        }
        String formName = formRepository.findByIdAndOwnerId(rule.getFormId(), ownerId).map(Form::getName)
                .orElse(null);
        return toResponse(rule, formName, saved, conns);
    }

    private Map<Long, AdConnection> connectionMap(Long ownerId) {
        return connectionRepository.findByOwnerIdOrderByIdAsc(ownerId).stream()
                .collect(Collectors.toMap(AdConnection::getId, Function.identity()));
    }

    private AdRule load(Long ownerId, Long id) {
        return ruleRepository.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new NotFoundException("규칙을 찾을 수 없습니다."));
    }

    private RuleResponse toResponse(AdRule r, String formName, List<AdRuleTarget> targets,
            Map<Long, AdConnection> conns) {
        RuleCondition c = catalog.conditionOrNull(r.getConditionType());
        RuleAction a = catalog.actionOrNull(r.getActionType());
        List<RuleTargetDto> ts = targets.stream().map(t -> {
            AdConnection conn = conns.get(t.getConnectionId());
            return new RuleTargetDto(t.getConnectionId(), conn == null ? null : conn.getLabel(),
                    conn == null ? null : conn.getPlatform().name(), t.getAccountId(), t.getCampaignId(),
                    t.getCampaignName());
        }).toList();
        return new RuleResponse(r.getId(), r.getName(), r.getFormId(), formName, r.isEnabled(), r.getPausedReason(),
                r.getConditionType(), r.getConditionConfig(),
                c == null ? r.getConditionType() : c.describe(r.getConditionConfig()),
                r.getActionType(), a == null ? r.getActionType() : a.label(), r.isNotifySuccess(),
                r.getLastFiredPeriod(), r.getLastFiredAt(), ts);
    }

    private static String clean(String s, int max) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        if (t.isEmpty()) {
            return null;
        }
        return t.length() > max ? t.substring(0, max) : t;
    }
}
