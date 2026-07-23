package com.leadpot.form;

/**
 * 폼 유형. 프론트는 유형별 렌더러를 두어 새 유형 추가 시 렌더러만 붙이면 되게 한다(M7 확장 구조).
 * - BASIC: 한 화면에 항목을 나열하는 기본형
 * - STEP: 단계별 선택형(스텝) — Phase 2B 에서 본격 구현
 * 이후 POPUP/INLINE_EMBED/CHAT 등 확장 예정.
 */
public enum FormType {
    BASIC,
    STEP
}
