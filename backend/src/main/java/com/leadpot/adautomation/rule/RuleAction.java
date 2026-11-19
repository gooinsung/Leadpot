package com.leadpot.adautomation.rule;

import java.util.List;
import java.util.Map;

import com.leadpot.adautomation.run.TargetResult;

/**
 * 규칙의 '동작' 종류. 새 동작(예산 감소·증액·켜기 …) = 이 인터페이스를 구현한 스프링 빈 1개 추가.
 * 동작은 대상마다 결과를 돌려주고, 이력·알림은 공통 코드가 처리한다.
 */
public interface RuleAction {

    String type();

    String label();

    Map<String, Object> normalize(Map<String, Object> config);

    /** 대상별로 실행한다. 한 대상의 실패가 다른 대상을 막지 않는다. 트랜잭션 밖에서 불린다. */
    List<TargetResult> execute(AdRule rule, List<AdRuleTarget> targets);
}
