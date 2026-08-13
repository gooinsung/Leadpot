import type { LeadAnswer } from "../../../api/client";
import { formatKrw, formatWon, manwonToWon, toInt } from "../format";
import type { CalcView, CalculatorDef } from "../types";
import { calcDebtRelief, type DebtReliefResult, type IneligibleReason } from "./index";

/**
 * 개인회생 탕감액 계산기 정의 — 계산 함수({@link calcDebtRelief})를 폼·화면에 붙이는 껍데기.
 * 계산 로직은 여기 두지 않는다. 여기가 하는 일은 "질문 스펙 · 표시 문구 · 리드 저장 형태"뿐이다.
 */

/**
 * 재산(청산가치) 선택지는 **구간의 상단값**을 쓴다.
 * 재산을 낮게 잡으면 탕감액이 과대 추정되고(위험한 방향), 높게 잡으면 과소 추정된다(안전한 방향).
 * 상담에서 "생각보다 더 좋다"로 뒤집는 건 괜찮지만 "말이 달라졌다"는 안 된다.
 */
const ASSET_OPTIONS = [
  { label: "거의 없음", desc: "예금·차량·보증금 모두 소액", value: "0" },
  { label: "1천만원 이하", value: "1000" },
  { label: "1천만 ~ 3천만원", value: "3000" },
  { label: "3천만 ~ 5천만원", value: "5000" },
  { label: "5천만원 이상", desc: "자가 보유 등", value: "8000" },
];

const COUNT_OPTIONS = (max: number, suffix = "명") =>
  Array.from({ length: max + 1 }, (_, i) => ({
    label: i === max ? `${i}${suffix} 이상` : `${i}${suffix}`,
    value: String(i),
  }));

/** 자격 미달 사유별 안내 — 계산이 안 되는 경우에도 **상담으로 이어지는** 문구여야 한다. */
const NOTICE: Record<IneligibleReason, string> = {
  NO_DISPOSABLE_INCOME:
    "현재 소득이 법에서 정한 최저생계비 이하입니다. 이 경우 개인회생보다 **개인파산**(빚 전액 면책)이 더 적합할 수 있습니다. 어느 쪽이 유리한지 전문가 확인이 필요합니다.",
  UNSECURED_DEBT_LIMIT:
    "무담보 채무가 10억원을 넘어 개인회생 대상이 아닙니다. 일반회생 등 다른 절차를 검토해야 합니다.",
  SECURED_DEBT_LIMIT:
    "담보 채무가 15억원을 넘어 개인회생 대상이 아닙니다. 일반회생 등 다른 절차를 검토해야 합니다.",
  NO_UNSECURED_DEBT:
    "입력하신 채무가 전부 담보 채무입니다. 담보 채무는 개인회생 변제계획 대상이 아니라 별도로 다뤄야 합니다.",
};

/** 총변제액을 결정한 기준 → 사용자에게 보여줄 한 줄 설명. 결과 신뢰도의 핵심이다. */
const BINDING_HINT: Record<DebtReliefResult["bindingConstraint"], string> = {
  DISPOSABLE_INCOME: "소득에서 생계비를 뺀 금액(가용소득)으로 정해졌습니다",
  MIN_REPAYMENT: "법이 정한 최소 변제금액(최저변제액)이 적용됐습니다",
  LIQUIDATION_VALUE: "보유 재산 가치만큼은 갚아야 하는 원칙(청산가치 보장)이 적용됐습니다",
  FULL_DEBT: "소득이 충분해 채무를 전액 변제하게 됩니다",
};

/** 전제·경고 플래그 → 화면 문구. 재산 관련 경고를 맨 앞에 둔다(오차가 위험한 방향이다). */
const WARNING_TEXT: Partial<Record<string, string>> = {
  ASSETS_ASSUMED_ZERO: "재산이 없다고 가정한 결과입니다. 재산이 있으면 탕감액이 줄어듭니다.",
  SECURED_DEBT_NOT_SPLIT: "담보 대출을 분리하지 않고 전체를 무담보 채무로 계산했습니다.",
  EXTRA_LIVING_COST_OMITTED:
    "주거비·의료비 등 추가 생계비를 넣지 않았습니다. 인정받으면 탕감액이 더 늘어납니다.",
  EXTRA_LIVING_COST_CAPPED: "추가 생계비가 법정 상한(기준 중위소득 100%)에 걸려 일부만 반영됐습니다.",
  LIVING_COST_PRORATED: "배우자 소득이 있어 생계비를 소득 비율로 나눠 계산했습니다.",
  PERIOD_EXTENDED: "법정 최소 변제금액을 맞추기 위해 변제기간이 36개월보다 길어졌습니다.",
  FLOOR_EXCEEDS_CAPACITY:
    "현재 소득으로는 60개월을 갚아도 법정 최소 금액에 못 미칩니다. 재산 처분이나 소득 증대 없이는 인가가 어려울 수 있습니다.",
  NO_RELIEF: "소득이 충분해 탕감 없이 전액 변제하게 됩니다. 개인회생의 실익이 거의 없습니다.",
};

function buildView(r: DebtReliefResult): CalcView {
  if (!r.eligible) {
    return {
      ok: false,
      headlineLabel: "예상 탕감액",
      headline: "계산 불가",
      notice: r.ineligibleReason ? NOTICE[r.ineligibleReason] : "입력값을 다시 확인해주세요.",
      breakdown:
        r.ineligibleReason === "NO_DISPOSABLE_INCOME"
          ? [
              { label: "월 소득", value: formatWon(r.livingCost + r.disposableIncome) },
              { label: `법정 생계비 (${r.householdSize}인 가구)`, value: formatWon(r.livingCost) },
              { label: "갚을 수 있는 여유 금액", value: "없음", hint: "소득이 생계비 이하입니다" },
            ]
          : [],
      warnings: (r.assumptions as string[]).map((f) => WARNING_TEXT[f]).filter((s): s is string => !!s),
    };
  }

  const months = r.repaymentMonths;
  return {
    ok: true,
    headlineLabel: "예상 탕감액",
    headline: formatKrw(r.reliefAmount),
    headlineSub: `탕감률 ${r.reliefRate}% · 월 ${formatKrw(r.monthlyRepayment)}씩 ${months}개월`,
    breakdown: [
      { label: "변제 대상 채무", value: formatWon(r.unsecuredDebt), hint: "담보 채무 제외" },
      {
        label: `법정 생계비 (${r.householdSize}인 가구)`,
        value: formatWon(r.livingCost),
        hint: `${r.year}년 기준 중위소득의 60%`,
      },
      { label: "월 가용소득", value: formatWon(r.disposableIncome), hint: "소득 − 생계비" },
      { label: "법정 최소 변제금액", value: formatWon(r.minRepayment) },
      { label: "청산가치 (재산)", value: formatWon(r.liquidationValue) },
      { label: "총 변제금액", value: formatWon(r.totalRepayment), hint: BINDING_HINT[r.bindingConstraint] },
      { label: "월 변제금", value: `${formatWon(r.monthlyRepayment)} × ${months}개월` },
    ],
    warnings: (r.assumptions as string[]).map((f) => WARNING_TEXT[f]).filter((s): s is string => !!s),
  };
}

export const debtReliefCalculator: CalculatorDef = {
  key: "debtRelief",
  name: "개인회생 탕감액 계산기",
  description:
    "채무·소득·부양가족·재산을 받아 개인회생으로 얼마를 탕감받을 수 있는지 법정 산식으로 계산합니다. 결과 화면 다음 단계에서 연락처를 받습니다.",
  disclaimer:
    "본 결과는 법정 산식에 따른 예상치이며 실제 인가 금액은 법원 심리(추가 생계비 인정 범위·재산 평가·채권자 이의)에 따라 달라질 수 있습니다. 법률 자문이 아닙니다.",

  // toAnswers() 의 label 과 순서·문구가 같아야 한다.
  outputLabels: ["예상 탕감액", "예상 탕감률", "예상 월 변제금", "월 가용소득", "변제 대상 채무"],

  inputs: [
    {
      key: "totalDebt",
      question: "총 채무액이 얼마인가요?",
      description: "카드·대출·연체금 등 전체 금액을 만원 단위로 입력해주세요.",
      required: true,
      answerType: "number",
      unit: "만원",
      placeholder: "예: 5000 (= 5천만원)",
    },
    {
      key: "monthlyIncome",
      question: "매달 실제로 받는 소득은 얼마인가요?",
      description: "세금·4대보험을 뺀 후 통장에 들어오는 금액입니다. 만원 단위로 입력해주세요.",
      required: true,
      answerType: "number",
      unit: "만원",
      placeholder: "예: 250 (= 250만원)",
    },
    {
      key: "dependents",
      question: "함께 사는 부양가족이 몇 명인가요?",
      description: "본인은 제외하고 세어주세요. 가족 수가 많으면 생계비가 늘어 탕감액이 커집니다.",
      required: true,
      answerType: "single",
      options: COUNT_OPTIONS(4),
    },
    {
      key: "assets",
      question: "보유하신 재산이 얼마쯤 되나요?",
      description: "부동산·차량·전월세 보증금·예금·보험 해지환급금을 모두 합한 금액입니다.",
      required: true,
      answerType: "single",
      options: ASSET_OPTIONS,
    },
    {
      key: "securedDebt",
      question: "총 채무 중 주택담보대출이 있나요?",
      description: "담보 대출은 개인회생 변제 대상이 아니라 따로 계산합니다. 없으면 0을 입력해주세요.",
      required: false,
      answerType: "number",
      unit: "만원",
      placeholder: "없으면 0",
    },
    {
      key: "minorChildren",
      question: "미성년 자녀가 몇 명인가요?",
      description: "자녀 교육비는 추가 생계비로 인정되어 탕감액이 늘어납니다.",
      required: false,
      answerType: "single",
      options: COUNT_OPTIONS(3),
    },
  ],

  run(raw) {
    return buildView(
      calcDebtRelief({
        totalDebt: manwonToWon(raw.totalDebt),
        monthlyIncome: manwonToWon(raw.monthlyIncome),
        dependents: toInt(raw.dependents),
        // 선택지를 안 고른 경우와 "거의 없음"(0)을 구분해야 한다 —
        // 미입력이면 undefined 로 넘겨 '재산 0 가정' 경고가 붙게 한다.
        assets: raw.assets === undefined || raw.assets === "" ? undefined : manwonToWon(raw.assets),
        securedDebt:
          raw.securedDebt === undefined || raw.securedDebt === "" ? undefined : manwonToWon(raw.securedDebt),
        minorChildren: toInt(raw.minorChildren),
      }),
    );
  },

  /**
   * 여기 label 이 그대로 **구글시트 열 이름**이자 **문자·알림톡 변수**(`{{예상 탕감액}}`)가 된다.
   * 이름을 바꾸면 이미 붙여둔 시트의 열과 템플릿이 어긋나므로 신중하게 바꿔야 한다.
   */
  toAnswers(view): LeadAnswer[] {
    if (!view.ok) {
      return [
        { label: "예상 탕감액", fieldType: "calc", value: "계산 불가" },
        { label: "계산 결과 안내", fieldType: "calc", value: (view.notice ?? "").replace(/\*\*/g, "") },
      ];
    }
    const pick = (label: string) => view.breakdown.find((b) => b.label.startsWith(label))?.value ?? "";
    return [
      { label: "예상 탕감액", fieldType: "calc", value: view.headline },
      { label: "예상 탕감률", fieldType: "calc", value: view.headlineSub?.match(/탕감률 ([\d.]+%)/)?.[1] ?? "" },
      { label: "예상 월 변제금", fieldType: "calc", value: pick("월 변제금") },
      { label: "월 가용소득", fieldType: "calc", value: pick("월 가용소득") },
      { label: "변제 대상 채무", fieldType: "calc", value: pick("변제 대상 채무") },
    ];
  },
};
