import type { CalculatorDef } from "../types";

/**
 * 정책자금 매칭 — **실제 계산이 없는** 계산기 종류(사용자 지시 2026-10-29).
 *
 * 레퍼런스(정책자금 매칭 랜딩)의 흐름을 그대로 따른다:
 * `질문들 → "정책자금 매칭중…" 로딩 → "매칭이 완료되었습니다! 연락처를 입력해주세요" → 완료 화면`.
 *
 * - 질문은 자동 생성하지 않는다({@link CalculatorDef.freeSteps}) — 마케터가 상호명·업종·지역·연매출·
 *   신용점수 등을 스텝형처럼 직접 만든다. 답은 일반 질문 답변으로 리드에 저장된다.
 * - 보여줄 결과가 없으므로 접수 뒤에는 리드폼의 완료 화면 설정을 쓴다({@link CalculatorDef.noResult}).
 *   결과(가능한 정책자금·한도)는 상담사가 연락해서 전한다.
 */
export const policyFundCalculator: CalculatorDef = {
  key: "policyFund",
  name: "정책자금 매칭",
  icon: "🏦",
  description:
    "질문은 스텝형처럼 직접 만듭니다. 마지막 질문 뒤 '정책자금 매칭중' 화면을 거쳐 '매칭이 완료되었습니다! 연락처를 입력해주세요' 화면으로 이어집니다.",
  // 결과 화면이 없어 실제로 노출되지 않지만, 모든 계산기가 갖는 규격이라 채워 둔다.
  disclaimer: "매칭 결과는 입력하신 정보를 바탕으로 한 안내이며, 실제 지원 여부와 한도는 각 기관의 심사에 따라 달라집니다.",
  freeSteps: true,
  noResult: true,
  contactStepLabel: "매칭 결과",
  preGateLoading: {
    title: "정책자금 매칭중",
    desc: "입력해주신 정보로 딱 맞는\n정책자금을 매칭하고 있어요.",
  },
  gate: {
    title: "정책자금 매칭이 완료되었습니다!",
    highlight: "결과를 받아보실 연락처를 입력해주세요.",
    bullets: [],
    explain: {
      title: "",
      body: "지금 신청하시면 **소상공인부터 중소기업까지**\n정책자금 전문가가 무료로 한도를 알려드려요!",
    },
    submitLabel: "결과 확인하기",
  },
  followUp: "",
  inputs: [],
  outputLabels: [],
  sampleInput: {},
  // 계산하지 않는다 — 연락처 단계(게이트)를 띄우려면 화면 재료가 있어야 해서 빈 값을 낸다.
  run() {
    return { ok: true, headlineLabel: "", headline: "", breakdown: [], warnings: [], data: {} };
  },
  toAnswers() {
    return [];
  },
};
