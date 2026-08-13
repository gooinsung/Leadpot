package com.leadpot.form;

/**
 * 리드폼 본문 블록 유형. 입력 항목(FIELD)과 콘텐츠 블록을 한 정렬 공간에서 섞어 배치한다(M4).
 */
public enum BlockType {
    FIELD,   // 입력 항목 (field_type 으로 세부 지정)
    IMAGE,   // 이미지 블록
    HTML,    // HTML 블록
    TEXT,    // 텍스트 블록
    DIVIDER, // 구분선
    SPACER,  // 여백
    CHOICE,  // STEP 단계의 질문 + 카드형 선택지 (content: question/description/selectType/options)
    /**
     * 계산기 블록 — 앞 단계 답변으로 값을 계산해 보여준다 (content: calcKey).
     * 계산은 프론트의 순수 함수가 하고, 결과는 리드 answers 에 fieldType="calc" 로 함께 저장된다.
     * 답변을 만드는 블록이 아니므로({@link FormBlock#producesAnswer}) 변수키는 받지 않는다.
     */
    CALC
}
