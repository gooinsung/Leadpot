package com.leadpot.adautomation.rule;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.leadpot.common.error.InvalidSubmissionException;

/**
 * 조건: 리드폼에 오늘(한국 시간 자정부터) 들어온 리드가 N건 이상.
 * 휴지통만 빼고 전부 센다(수기·엑셀 포함 — 결정 4). 기간 키 = KST 날짜라 하루에 한 번만 발동한다.
 */
@Component
public class DailyLeadCountCondition implements RuleCondition {

    public static final String TYPE = "DAILY_LEAD_COUNT";
    static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final int MAX_LIMIT = 100_000;

    private final AdRuleRepository ruleRepository;

    public DailyLeadCountCondition(AdRuleRepository ruleRepository) {
        this.ruleRepository = ruleRepository;
    }

    @Override
    public String type() {
        return TYPE;
    }

    @Override
    public String label() {
        return "하루 리드 수량";
    }

    @Override
    public Map<String, Object> normalize(Map<String, Object> config) {
        Object raw = config == null ? null : config.get("limit");
        int limit;
        try {
            limit = raw instanceof Number n ? n.intValue() : Integer.parseInt(String.valueOf(raw).trim());
        } catch (NumberFormatException e) {
            throw new InvalidSubmissionException("하루 수량은 숫자로 입력해주세요.");
        }
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new InvalidSubmissionException("하루 수량은 1 ~ " + MAX_LIMIT + " 사이로 입력해주세요.");
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("limit", limit);
        return out;
    }

    @Override
    public String describe(Map<String, Object> config) {
        return "하루 " + limit(config) + "건 도달 시";
    }

    @Override
    public Evaluation evaluate(AdRule rule, Instant now) {
        int limit = limit(rule.getConditionConfig());
        LocalDate today = now.atZone(KST).toLocalDate();
        Instant since = today.atStartOfDay(KST).toInstant();
        long count = ruleRepository.countLeadsSince(rule.getFormId(), since);
        return new Evaluation(limit > 0 && count >= limit, today.toString(),
                "오늘 " + count + "건 / 상한 " + limit + "건");
    }

    private static int limit(Map<String, Object> config) {
        Object v = config == null ? null : config.get("limit");
        return v instanceof Number n ? n.intValue() : 0;
    }
}
