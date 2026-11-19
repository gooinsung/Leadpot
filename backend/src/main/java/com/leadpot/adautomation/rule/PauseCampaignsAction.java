package com.leadpot.adautomation.rule;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.leadpot.adautomation.run.AdCampaignOperator;
import com.leadpot.adautomation.run.TargetResult;

/** 동작: 대상 캠페인 끄기(다시 켜지 않는다 — 결정 8). */
@Component
public class PauseCampaignsAction implements RuleAction {

    public static final String TYPE = "PAUSE_CAMPAIGNS";

    private final AdCampaignOperator operator;

    public PauseCampaignsAction(AdCampaignOperator operator) {
        this.operator = operator;
    }

    @Override
    public String type() {
        return TYPE;
    }

    @Override
    public String label() {
        return "캠페인 끄기";
    }

    @Override
    public Map<String, Object> normalize(Map<String, Object> config) {
        return Map.of();
    }

    @Override
    public List<TargetResult> execute(AdRule rule, List<AdRuleTarget> targets) {
        List<TargetResult> out = new ArrayList<>();
        for (AdRuleTarget t : targets) {
            out.add(operator.setCampaignActive(rule.getOwnerId(), t.getConnectionId(), t.getAccountId(),
                    t.getCampaignId(), t.getCampaignName(), false, rule));
        }
        return out;
    }
}
