import { LATEST_YEAR, LAW, YEAR_STANDARDS, medianIncomeFor } from "./standards";

/**
 * 개인회생 예상 탕감액 계산기 (리드팟 계산기 블록용).
 *
 * 외부 의존이 없는 **순수 함수**다 — 브라우저에서 즉시 돌고, 임베드 번들(embed.js)에도 그대로 들어간다.
 * 법정 산식을 그대로 구현하므로 "AI 추정"이 아니라 재현 가능한 계산이다.
 *
 * <pre>
 * ① 가용소득  = 월 실수령소득 − 생계비(기준중위소득 × 60% + 추가생계비)
 * ② 총변제액  = max(가용소득 × 변제기간, 최저변제액, 청산가치)   ← 3원칙 중 최댓값
 * ③ 탕감액    = 무담보채무 − 총변제액
 * </pre>
 *
 * ⚠️ 결과는 **예상치**다. 실제 인가액은 법원 심리(추가생계비 인정 범위·재산 평가·채권자 이의)로 달라진다.
 * 화면에서는 반드시 {@link DebtReliefResult.assumptions} 를 함께 노출해 전제를 밝힌다.
 */

/** 계산 불가 사유. 각각 화면 안내 문구와 후속 액션(파산 상담 등)이 다르다. */
export type IneligibleReason =
  /** 무담보채무가 10억 초과 — 개인회생 신청 자격 없음 */
  | "UNSECURED_DEBT_LIMIT"
  /** 담보채무가 15억 초과 — 개인회생 신청 자격 없음 */
  | "SECURED_DEBT_LIMIT"
  /** 변제 대상 채무(무담보)가 없음 */
  | "NO_UNSECURED_DEBT"
  /** 소득이 생계비 이하 → 변제할 재원이 없다. 개인회생이 아니라 **개인파산** 트랙. */
  | "NO_DISPOSABLE_INCOME";

/** 총변제액을 결정한 기준(3원칙 중 어느 것이 이겼는지). 화면에 "왜 이 금액인지" 설명하는 근거. */
export type BindingConstraint = "DISPOSABLE_INCOME" | "MIN_REPAYMENT" | "LIQUIDATION_VALUE" | "FULL_DEBT";

/** 결과에 붙는 전제·경고. 화면에서 그대로 문구로 풀어 보여준다. */
export type ResultFlag =
  /** 재산을 입력받지 않아 0으로 가정했다 → 탕감액이 **과대** 추정될 수 있다(위험한 방향). */
  | "ASSETS_ASSUMED_ZERO"
  /** 추가생계비를 입력받지 않았다 → 탕감액이 **과소** 추정된다(상담에서 더 좋아질 수 있는 방향). */
  | "EXTRA_LIVING_COST_OMITTED"
  /** 담보채무를 분리하지 않았다 → 총채무를 전부 무담보로 보고 계산했다. */
  | "SECURED_DEBT_NOT_SPLIT"
  /** 배우자 소득으로 생계비를 안분했다(단순 비율 안분 — 실무는 사안별로 다르다). */
  | "LIVING_COST_PRORATED"
  /** 추가생계비가 중위소득 100% 상한에 걸려 잘렸다. */
  | "EXTRA_LIVING_COST_CAPPED"
  /** 최저변제액·청산가치를 맞추려 변제기간을 요청값보다 늘렸다. */
  | "PERIOD_EXTENDED"
  /** 법정 하한을 60개월 가용소득으로도 못 채운다 → 재산 처분·소득 증대 없이는 인가가 어렵다. */
  | "FLOOR_EXCEEDS_CAPACITY"
  /** 채무를 전액 변제하게 된다 → 개인회생 실익이 없다. */
  | "NO_RELIEF";

export interface DebtReliefInput {
  /** 총채무액(원). 담보대출을 포함한 전체. */
  totalDebt: number;
  /** 월 실수령소득(원, **세후**). 법정 가용소득 정의가 제세공과금 공제 후다. */
  monthlyIncome: number;

  /** 부양가족 수. 가구원수 = 부양가족 + 1(본인). 기본 0. */
  dependents?: number;
  /** 총채무 중 담보채무(원). 담보채무는 별제권이라 변제계획 대상이 아니다. 기본 0. */
  securedDebt?: number;
  /** 재산 평가액(원) = 청산가치. 미입력이면 0으로 보고 경고 플래그를 남긴다. */
  assets?: number;
  /** 미성년 자녀 수. 1인당 월 20만원 교육비를 추가생계비로 가산한다. 기본 0. */
  minorChildren?: number;
  /** 직접 지정하는 추가생계비(주거비·의료비 등, 월 원). 기본 0. */
  extraLivingCost?: number;
  /** 배우자 월소득(원). 0보다 크면 생계비를 소득 비율로 안분한다. 기본 0. */
  spouseIncome?: number;

  /** 변제기간(개월). 기본 36, 상한 60. */
  repaymentMonths?: number;
  /** 기준값 연도. 기본은 최신 연도. */
  year?: number;
}

export interface DebtReliefResult {
  /** false 면 나머지 금액 필드는 0이고 {@link ineligibleReason} 을 봐야 한다. */
  eligible: boolean;
  ineligibleReason: IneligibleReason | null;

  /** 사용한 기준값 연도 */
  year: number;
  /** 가구원수(본인 포함) */
  householdSize: number;
  /** 가구원수에 대응하는 월 기준 중위소득 */
  medianIncome: number;
  /** 기본 생계비 = 중위소득 × 60% */
  baseLivingCost: number;
  /** 실제 적용된 생계비(기본 + 추가, 상한·안분 반영) */
  livingCost: number;
  /** 월 가용소득 = 월소득 − 생계비 */
  disposableIncome: number;

  /** 변제 대상 채무 = 총채무 − 담보채무 */
  unsecuredDebt: number;
  /** 최저변제액(법정 하한) */
  minRepayment: number;
  /** 청산가치(= 재산 평가액) */
  liquidationValue: number;

  /** 최종 변제기간(개월). 하한을 맞추려 늘어났을 수 있다. */
  repaymentMonths: number;
  /** 총변제액 */
  totalRepayment: number;
  /** 월 변제금 */
  monthlyRepayment: number;
  /** 총변제액을 결정한 기준 */
  bindingConstraint: BindingConstraint;

  /** 탕감액 = 무담보채무 − 총변제액 */
  reliefAmount: number;
  /** 탕감률(%) — 소수 1자리 */
  reliefRate: number;

  /** 전제·경고 */
  assumptions: ResultFlag[];
}

/** 음수·NaN 을 막고 정수 원 단위로 정리한다. */
function toWon(v: number | undefined): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return 0;
  return Math.round(v);
}

function ineligible(reason: IneligibleReason, partial: Partial<DebtReliefResult>): DebtReliefResult {
  return {
    eligible: false,
    ineligibleReason: reason,
    year: LATEST_YEAR,
    householdSize: 1,
    medianIncome: 0,
    baseLivingCost: 0,
    livingCost: 0,
    disposableIncome: 0,
    unsecuredDebt: 0,
    minRepayment: 0,
    liquidationValue: 0,
    repaymentMonths: LAW.DEFAULT_MONTHS,
    totalRepayment: 0,
    monthlyRepayment: 0,
    bindingConstraint: "DISPOSABLE_INCOME",
    reliefAmount: 0,
    reliefRate: 0,
    assumptions: [],
    ...partial,
  };
}

/**
 * 최저변제액(채무자회생법 제614조 ②-3).
 * 5천만원 미만이면 5%, 이상이면 3%+100만원. 상한 3천만원이고 채무액을 넘지도 않는다.
 */
export function minRepaymentFor(unsecuredDebt: number): number {
  const raw =
    unsecuredDebt < LAW.MIN_REPAYMENT_THRESHOLD
      ? unsecuredDebt * LAW.MIN_REPAYMENT_RATE_UNDER
      : unsecuredDebt * LAW.MIN_REPAYMENT_RATE_OVER + LAW.MIN_REPAYMENT_ADD_OVER;
  return Math.round(Math.min(raw, LAW.MIN_REPAYMENT_CAP, unsecuredDebt));
}

/** 개인회생 예상 탕감액 계산. */
export function calcDebtRelief(input: DebtReliefInput): DebtReliefResult {
  const year = input.year && YEAR_STANDARDS[input.year] ? input.year : LATEST_YEAR;
  const std = YEAR_STANDARDS[year];
  const flags: ResultFlag[] = [];

  const totalDebt = toWon(input.totalDebt);
  const monthlyIncome = toWon(input.monthlyIncome);
  const securedDebt = Math.min(toWon(input.securedDebt), totalDebt);
  const assets = toWon(input.assets);
  const spouseIncome = toWon(input.spouseIncome);
  const minorChildren = Math.max(0, Math.floor(input.minorChildren ?? 0));
  const dependents = Math.max(0, Math.floor(input.dependents ?? 0));
  const householdSize = dependents + 1;

  if (input.assets === undefined) flags.push("ASSETS_ASSUMED_ZERO");
  if (input.securedDebt === undefined) flags.push("SECURED_DEBT_NOT_SPLIT");
  if (input.extraLivingCost === undefined && minorChildren === 0) flags.push("EXTRA_LIVING_COST_OMITTED");

  // ── 자격 게이트 ────────────────────────────────────────────────
  const unsecuredDebt = totalDebt - securedDebt;
  if (unsecuredDebt > LAW.UNSECURED_DEBT_LIMIT) {
    return ineligible("UNSECURED_DEBT_LIMIT", { year, householdSize, unsecuredDebt });
  }
  if (securedDebt > LAW.SECURED_DEBT_LIMIT) {
    return ineligible("SECURED_DEBT_LIMIT", { year, householdSize, unsecuredDebt });
  }
  if (unsecuredDebt <= 0) {
    return ineligible("NO_UNSECURED_DEBT", { year, householdSize, unsecuredDebt });
  }

  // ── ① 생계비와 가용소득 ────────────────────────────────────────
  const medianIncome = medianIncomeFor(std, householdSize);
  const baseLivingCost = Math.round(medianIncome * std.livingCostRate);
  const extra = toWon(input.extraLivingCost) + minorChildren * LAW.EDUCATION_COST_PER_CHILD;

  // 기본 + 추가 생계비는 중위소득 100% 를 넘을 수 없다(실무준칙 제405호).
  let livingCost = baseLivingCost + extra;
  if (livingCost > medianIncome) {
    livingCost = medianIncome;
    flags.push("EXTRA_LIVING_COST_CAPPED");
  }

  // 배우자에게 소득이 있으면 가구 생계비를 소득 비율로 안분한다(단순 안분 — 실무는 사안별).
  if (spouseIncome > 0 && monthlyIncome + spouseIncome > 0) {
    livingCost = Math.round((livingCost * monthlyIncome) / (monthlyIncome + spouseIncome));
    flags.push("LIVING_COST_PRORATED");
  }

  const disposableIncome = monthlyIncome - livingCost;
  if (disposableIncome <= 0) {
    // 갚을 재원이 없으면 개인회생은 인가될 수 없다 → 개인파산 검토 대상.
    return ineligible("NO_DISPOSABLE_INCOME", {
      year,
      householdSize,
      medianIncome,
      baseLivingCost,
      livingCost,
      disposableIncome,
      unsecuredDebt,
      liquidationValue: assets,
      assumptions: flags,
    });
  }

  // ── ② 3원칙 중 최댓값 ─────────────────────────────────────────
  const minRepayment = minRepaymentFor(unsecuredDebt);
  const liquidationValue = assets;

  const requestedMonths = Math.min(
    LAW.MAX_MONTHS,
    Math.max(1, Math.floor(input.repaymentMonths ?? LAW.DEFAULT_MONTHS)),
  );
  let months = requestedMonths;
  const floor = Math.max(minRepayment, liquidationValue);

  // 어느 기준이 금액을 지배하는지는 **요청한 변제기간**을 기준으로 판단한다.
  // (하한 때문에 기간을 늘린 뒤 비교하면 늘 가용소득이 이긴 것처럼 보인다 — 근거 표시가 뒤집힌다.)
  let bindingConstraint: BindingConstraint =
    floor <= disposableIncome * requestedMonths
      ? "DISPOSABLE_INCOME"
      : liquidationValue >= minRepayment
        ? "LIQUIDATION_VALUE"
        : "MIN_REPAYMENT";

  // 가용소득만으로 하한을 못 채우면 실무처럼 변제기간을 늘린다(월변제금을 가용소득 위로 올릴 수는 없다).
  if (disposableIncome * months < floor) {
    const needed = Math.ceil(floor / disposableIncome);
    months = Math.min(needed, LAW.MAX_MONTHS);
    if (months > requestedMonths) flags.push("PERIOD_EXTENDED");
    if (needed > LAW.MAX_MONTHS) flags.push("FLOOR_EXCEEDS_CAPACITY");
  }

  let totalRepayment = Math.max(disposableIncome * months, floor);

  // 채무보다 많이 갚을 이유는 없다 → 전액 변제로 끝나면 회생 실익이 없다.
  if (totalRepayment >= unsecuredDebt) {
    totalRepayment = unsecuredDebt;
    months = Math.min(LAW.MAX_MONTHS, Math.max(1, Math.ceil(unsecuredDebt / disposableIncome)));
    bindingConstraint = "FULL_DEBT";
    flags.push("NO_RELIEF");
  }

  totalRepayment = Math.round(totalRepayment);
  const reliefAmount = unsecuredDebt - totalRepayment;

  return {
    eligible: true,
    ineligibleReason: null,
    year,
    householdSize,
    medianIncome,
    baseLivingCost,
    livingCost,
    disposableIncome,
    unsecuredDebt,
    minRepayment,
    liquidationValue,
    repaymentMonths: months,
    totalRepayment,
    monthlyRepayment: Math.round(totalRepayment / months),
    bindingConstraint,
    reliefAmount,
    reliefRate: Math.round((reliefAmount / unsecuredDebt) * 1000) / 10,
    assumptions: flags,
  };
}
