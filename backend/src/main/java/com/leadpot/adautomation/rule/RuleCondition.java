package com.leadpot.adautomation.rule;

import java.time.Instant;
import java.util.Map;

/**
 * 규칙의 '조건' 종류. 새 조건(주 수량·CPA·시간대 …) = 이 인터페이스를 구현한 스프링 빈 1개 추가.
 * 엔진·화면·알림·이력은 공통이라 손대지 않는다({@link RuleCatalog} 가 자동 등록).
 */
public interface RuleCondition {

    /** 저장되는 종류 키(예: DAILY_LEAD_COUNT). 바꾸면 기존 규칙이 깨지므로 고정한다. */
    String type();

    /** 화면 표시 이름. */
    String label();

    /** 화면에서 받은 설정을 검증·정규화(실패 시 InvalidSubmissionException). */
    Map<String, Object> normalize(Map<String, Object> config);

    /** 사람이 읽는 설명(예: "하루 5건 도달 시"). */
    String describe(Map<String, Object> config);

    /** 지금 조건을 만족하는가. 트랜잭션 밖에서 불린다(필요한 조회는 각자 짧게). */
    Evaluation evaluate(AdRule rule, Instant now);

    /**
     * @param periodKey 기간 키(예: 일 수량이면 KST 날짜). 같은 키로는 한 번만 발동한다.
     * @param summary   알림·이력에 쓸 설명(예: "오늘 5건 / 상한 5건")
     */
    record Evaluation(boolean met, String periodKey, String summary) {
    }
}
