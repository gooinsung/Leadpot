package com.leadpot.adautomation.rule;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.leadpot.common.error.InvalidSubmissionException;

/** 등록된 조건·동작 종류 목록(스프링이 빈을 모두 넘겨준다). */
@Component
public class RuleCatalog {

    private final Map<String, RuleCondition> conditions = new LinkedHashMap<>();
    private final Map<String, RuleAction> actions = new LinkedHashMap<>();

    public RuleCatalog(List<RuleCondition> conditionBeans, List<RuleAction> actionBeans) {
        conditionBeans.forEach(c -> conditions.put(c.type(), c));
        actionBeans.forEach(a -> actions.put(a.type(), a));
    }

    public RuleCondition condition(String type) {
        RuleCondition c = conditions.get(type);
        if (c == null) {
            throw new InvalidSubmissionException("지원하지 않는 조건입니다: " + type);
        }
        return c;
    }

    public RuleAction action(String type) {
        RuleAction a = actions.get(type);
        if (a == null) {
            throw new InvalidSubmissionException("지원하지 않는 동작입니다: " + type);
        }
        return a;
    }

    public RuleCondition conditionOrNull(String type) {
        return conditions.get(type);
    }

    public RuleAction actionOrNull(String type) {
        return actions.get(type);
    }

    public Map<String, RuleCondition> conditions() {
        return conditions;
    }

    public Map<String, RuleAction> actions() {
        return actions;
    }
}
