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

/**
 * 개인회생으로 계산이 안 되는 경우의 안내.
 *
 * **"안 됩니다"로 끝내지 않는다** — 개인회생이 막히는 건 대부분 파산이 더 유리하다는 뜻이고,
 * 그 판단이야말로 전문가 상담이 필요한 지점이다. 문구는 항상 다음 행동으로 이어져야 한다.
 */
const NOTICE: Record<IneligibleReason, string> = {
  INSUFFICIENT_INCOME:
    "현재 소득 대비 채무가 많아 **개인회생보다 개인파산이 유리할 수 있습니다.** 개인파산은 빚을 나눠 갚는 게 아니라 **전액 면책**(빚이 사라짐)을 받는 절차입니다.\n지금 무료 상담을 받으시면 두 절차 중 어느 쪽이 유리한지, 면책까지 얼마나 걸리는지 자세히 알려드립니다.",
  UNSECURED_DEBT_LIMIT:
    "채무가 10억원을 넘어 개인회생 한도를 초과했습니다. 이런 규모는 **일반회생** 등 다른 절차로 해결하는 것이 맞습니다.\n지금 무료 상담을 받으시면 어떤 절차가 가능한지 알려드립니다.",
  SECURED_DEBT_LIMIT:
    "담보 채무가 15억원을 넘어 개인회생 한도를 초과했습니다. 이런 규모는 **일반회생** 등 다른 절차로 해결하는 것이 맞습니다.\n지금 무료 상담을 받으시면 어떤 절차가 가능한지 알려드립니다.",
  NO_UNSECURED_DEBT:
    "입력하신 채무가 전부 담보 대출로 잡혔습니다. 담보 대출은 개인회생으로 줄이는 대상이 아니라 따로 다뤄야 합니다.\n담보 대출을 뺀 나머지 채무 금액으로 다시 계산해보시거나, 무료 상담으로 확인해보세요.",
};

/** 재산이 많아 소득으로 청산가치를 못 채우는 경우 — 파산 안내는 오히려 불리하다(재산이 처분된다). */
const NOTICE_ASSETS_HEAVY =
  "보유 재산이 소득에 비해 많습니다. 개인회생은 **재산 가치만큼은 갚아야** 하는데(청산가치 보장), 지금 소득으로는 그 금액을 채우기 어렵습니다.\n이 경우 재산을 정리해 진행하거나 다른 절차를 택해야 합니다. 무료 상담으로 가장 유리한 방법을 확인해보세요.";

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
  LIVING_COST_REDUCED:
    "소득이 법정 생계비보다 적어, 생계비를 줄여 변제하는 안으로 계산했습니다. 실무에서 흔한 방식이지만 법원 재량이라 상담으로 확인이 필요합니다.",
  NO_RELIEF: "소득이 충분해 탕감 없이 전액 변제하게 됩니다. 개인회생의 실익이 거의 없습니다.",
};

function buildView(r: DebtReliefResult): CalcView {
  if (!r.eligible) {
    // 재산이 많아 막힌 경우는 파산 안내가 오히려 불리하다(파산하면 그 재산이 처분된다).
    const assetsHeavy =
      r.ineligibleReason === "INSUFFICIENT_INCOME" && r.liquidationValue >= r.minRepayment && r.liquidationValue > 0;
    return {
      ok: false,
      headlineLabel: "나의 예상 탕감액은?",
      headline: "",
      notice: assetsHeavy
        ? NOTICE_ASSETS_HEAVY
        : r.ineligibleReason
          ? NOTICE[r.ineligibleReason]
          : "입력값을 다시 확인해주세요.",
      breakdown:
        r.ineligibleReason === "INSUFFICIENT_INCOME"
          ? [
              { label: "월 소득", value: formatWon(r.livingCost + r.disposableIncome) },
              {
                label: `법정 생계비 (${r.householdSize}인 가구)`,
                value: formatWon(r.livingCost),
                hint: `${r.year}년 기준 중위소득의 60%`,
              },
              { label: "변제 대상 채무", value: formatWon(r.unsecuredDebt) },
              { label: "법정 최소 변제금액", value: formatWon(r.minRepayment) },
              ...(r.liquidationValue > 0
                ? [{ label: "청산가치 (재산)", value: formatWon(r.liquidationValue) }]
                : []),
            ]
          : [],
      warnings: (r.assumptions as string[]).map((f) => WARNING_TEXT[f]).filter((s): s is string => !!s),
      // 계산이 안 된 리드도 상담 대상이므로 사유를 남긴다 — 상담사가 파산/일반회생으로 바로 붙는다.
      data: {
        "예상 탕감액": "개인회생 불가",
        "예상 탕감률": assetsHeavy ? "재산 정리 필요" : "개인파산 검토 대상",
        "예상 월 변제금": "",
        "월 가용소득": formatWon(Math.max(0, r.disposableIncome)),
        "변제 대상 채무": formatWon(r.unsecuredDebt),
      },
    };
  }

  const months = r.repaymentMonths;
  return {
    ok: true,
    // 탕감률을 가장 크게 — 금액보다 비율이 더 강하게 꽂힌다(사용자 결정 2026-08-13).
    headlineLabel: "나의 예상 탕감액은?",
    headline: `${r.reliefRate}%`,
    headlineSub: `예상 탕감액 ${formatKrw(r.reliefAmount)}`,
    headlineNote: `월 ${formatKrw(r.monthlyRepayment)}씩 ${months}개월 상환`,
    breakdown: [
      { label: "변제 대상 채무", value: formatWon(r.unsecuredDebt), hint: "담보 채무 제외" },
      {
        label: `적용 생계비 (${r.householdSize}인 가구)`,
        value: formatWon(r.livingCost),
        hint: r.assumptions.includes("LIVING_COST_REDUCED")
          ? "변제가 가능하도록 줄여 적용한 금액"
          : `${r.year}년 기준 중위소득의 60%`,
      },
      { label: "월 가용소득", value: formatWon(r.disposableIncome), hint: "소득 − 생계비" },
      { label: "법정 최소 변제금액", value: formatWon(r.minRepayment) },
      { label: "청산가치 (재산)", value: formatWon(r.liquidationValue) },
      { label: "총 변제금액", value: formatWon(r.totalRepayment), hint: BINDING_HINT[r.bindingConstraint] },
      { label: "월 변제금", value: `${formatWon(r.monthlyRepayment)} × ${months}개월` },
    ],
    warnings: (r.assumptions as string[]).map((f) => WARNING_TEXT[f]).filter((s): s is string => !!s),
    data: {
      "예상 탕감액": formatKrw(r.reliefAmount),
      "예상 탕감률": `${r.reliefRate}%`,
      "예상 월 변제금": `${formatWon(r.monthlyRepayment)} × ${months}개월`,
      "월 가용소득": formatWon(r.disposableIncome),
      "변제 대상 채무": formatWon(r.unsecuredDebt),
    },
  };
}

export const debtReliefCalculator: CalculatorDef = {
  key: "debtRelief",
  name: "개인회생 탕감액 계산기",
  description:
    "채무·소득·부양가족·재산을 받아 개인회생으로 얼마를 탕감받을 수 있는지 법정 산식으로 계산합니다. 결과 화면 다음 단계에서 연락처를 받습니다.",
  disclaimer:
    "본 결과는 법정 산식에 따른 예상치이며 실제 인가 금액은 법원 심리(추가 생계비 인정 범위·재산 평가·채권자 이의)에 따라 달라질 수 있습니다. 법률 자문이 아닙니다.",

  gate: {
    title: "진단이 끝났습니다",
    highlight: "지금 바로 확인 가능합니다.",
    bullets: [
      "내 예상 탕감률·탕감액 — 전·후 변화 확인",
      "월 변제금이 얼마로 줄어드는지",
      "법정 산식 기준 산출 근거 전체 공개",
      "나에게 개인회생이 맞는지 (맞춤 설명 필요)",
    ],
    explain: {
      title: "탕감액이 무엇인가요?",
      body:
        "개인회생은 빚 전부를 갚는 절차가 아닙니다. 소득에서 법이 정한 생계비를 뺀 금액만 **원칙적으로 3년간(예외적인 경우 최대 5년) 나눠 갚고**, 그 기간을 마치면 **남은 빚은 법원 결정으로 사라집니다.**\n이렇게 **갚지 않아도 되는 금액**이 탕감액이고, 전체 채무에서 탕감액이 차지하는 비율이 탕감률입니다.",
    },
    submitLabel: "탕감액 확인하고 무료상담 받아보기",
  },

  followUp:
    "위 진단 내용으로 **도산 전문 변호사가 직접 무료 상담 전화**를 드리고 있습니다.\n전화를 꼭 받아 더 자세한 설명을 들어보세요 — 추가 생계비를 인정받으면 탕감액이 더 늘어날 수 있습니다.",

  // 빌더 미리보기용 예시 — 채무 8,000만 / 월 450만 / 3인 / 재산 1,000만
  sampleInput: { totalDebt: "8000", monthlyIncome: "450", dependents: "2", assets: "1000" },

  // toAnswers() 의 label 과 순서·문구가 같아야 한다.
  outputLabels: ["예상 탕감액", "예상 탕감률", "예상 월 변제금", "월 가용소득", "변제 대상 채무"],

  inputs: [
    {
      key: "totalDebt",
      // 담보채무를 따로 묻지 않고 여기서 제외시킨다(사용자 결정 2026-08-13, B안).
      // 단계를 하나 줄이는 대가로, 제외하지 않고 입력하면 탕감액이 과대 추정된다 →
      // 결과의 '변제 대상 채무' 근거에 "주택담보대출 제외" 를 남겨 전제를 드러낸다.
      question: "총 채무액이 얼마인가요?",
      description:
        "카드·신용대출·연체금 등을 만원 단위로 입력해주세요. 주택담보대출은 빼고 입력해주세요 — 담보 대출은 개인회생 변제 대상이 아닙니다.",
      required: true,
      answerType: "number",
      unit: "만원",
      placeholder: "예: 5000 (= 5천만원)",
    },
    {
      key: "monthlyIncome",
      // 가용소득은 **채무자 본인**의 소득으로 산정한다. 배우자 소득은 합산하지 않는다
      // (대신 생계비를 안분한다) — 합산해 입력하면 탕감액이 과소 추정된다.
      question: "본인의 월 소득은 얼마인가요?",
      description:
        "세금·4대보험을 뺀 후 통장에 들어오는 금액입니다. 배우자·가족 소득은 합치지 말고 본인 소득만 만원 단위로 입력해주세요.",
      required: true,
      answerType: "number",
      unit: "만원",
      placeholder: "예: 250 (= 250만원)",
    },
    {
      key: "dependents",
      // 소득이 있는 배우자·성인 가족은 부양가족이 아니다. 포함하면 생계비가 부풀려진다.
      question: "본인이 부양하는 가족이 몇 명인가요?",
      description: "본인은 제외하고, 소득이 있는 가족도 빼고 세어주세요. 부양가족이 많으면 탕감액이 커집니다.",
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
        // 담보채무는 1번 질문에서 이미 제외하고 받았으므로 0 을 **명시**한다.
        // undefined 로 두면 "담보 대출을 분리하지 않았다" 경고가 늘 붙어 거짓 안내가 된다.
        securedDebt: 0,
        // 자녀 교육비(추가생계비)는 묻지 않는다 — 주거비 지역별 표를 못 구한 상태에서 작은 항목만
        // 반영하면 어중간해진다. 추가생계비를 일관되게 0 으로 두면 탕감액이 **낮게** 나오고(안전한 방향)
        // 결과의 EXTRA_LIVING_COST_OMITTED 경고가 그대로 상담 훅이 된다.
        // 계산 함수는 minorChildren·extraLivingCost 를 계속 지원한다 — 표를 구하면 되살린다.
        minorChildren: 0,
      }),
    );
  },

  /**
   * 여기 label 이 그대로 **구글시트 열 이름**이자 **문자·알림톡 변수**(`{{예상 탕감액}}`)가 된다.
   * 이름을 바꾸면 이미 붙여둔 시트의 열과 템플릿이 어긋나므로 신중하게 바꿔야 한다.
   *
   * 값은 {@link CalcView.data} 에서만 가져온다 — 화면 문구를 파싱하면 문구 수정 때마다 저장이 깨진다.
   */
  toAnswers(view): LeadAnswer[] {
    return this.outputLabels.map((label) => ({
      label,
      fieldType: "calc",
      value: view.data[label] ?? "",
    }));
  },
};
