package com.leadpot.form;

/**
 * 폼 본문 블록 유형. 입력 항목(FIELD)과 콘텐츠 블록을 한 정렬 공간에서 섞어 배치한다(M4).
 */
public enum BlockType {
    FIELD,   // 입력 항목 (field_type 으로 세부 지정)
    IMAGE,   // 이미지 블록
    HTML,    // HTML 블록
    TEXT,    // 텍스트 블록
    DIVIDER, // 구분선
    SPACER,  // 여백
    CHOICE   // STEP 단계의 질문 + 카드형 선택지 (content: question/description/selectType/options)
}
