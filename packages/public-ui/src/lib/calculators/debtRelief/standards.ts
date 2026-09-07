/**
 * 개인회생 탕감액 계산에 쓰는 기준값.
 *
 * 두 종류를 분리해 둔다 —
 * - {@link YEAR_STANDARDS}: **매년 바뀐다**(보건복지부 기준 중위소득 고시). 연초에 표만 추가하면 된다.
 * - {@link LAW}: 법령·실무준칙에 박힌 값. 법이 바뀌지 않으면 그대로다.
 *
 * ⚠️ 여기 숫자를 고칠 때는 반드시 출처를 함께 갱신한다. 화면에 "법정 기준으로 계산"이라고
 * 표시하는 값이므로 근거 없는 수정은 곧 허위 표시가 된다.
 */

export interface YearStandards {
  year: number;
  /** 가구원수 1~6인의 월 기준 중위소득(원). 인덱스 0 = 1인 가구. */
  medianIncome: readonly number[];
  /** 7인 이상 가구는 1인 늘어날 때마다 이 금액을 가산한다(6인 − 5인 차액). */
  extraPerPerson: number;
  /** 생계비 = 기준 중위소득 × 이 비율. 실무 **원칙값**(서울회생법원). 법원은 이보다 증감할 수 있다. */
  livingCostRate: number;
  /**
   * 생계비를 줄여 변제 재원을 만들 때의 **하한 비율**.
   *
   * 소득이 원칙 생계비(60%)보다 적어도 개인회생은 가능하다 — 법원이 "60%보다 높거나 낮게"
   * 생계비를 인정하기 때문이다. 다만 무한정 줄일 수는 없으므로, 국가가 정한 최저 생활 보장선인
   * **생계급여 기준(기준 중위소득의 32%)** 을 하한으로 본다. 이보다 낮으면 실질적으로 생활이
   * 불가능하므로 개인회생이 아니라 개인파산 트랙으로 안내한다.
   */
  survivalRate: number;
  source: string;
}

/** 연도별 기준값. 키 = 연도. */
export const YEAR_STANDARDS: Record<number, YearStandards> = {
  2026: {
    year: 2026,
    // 보건복지부 2026년도 기준 중위소득 (4인 기준 6.51% 인상 — 역대 최대)
    medianIncome: [2_564_238, 4_199_292, 5_359_036, 6_494_738, 7_556_719, 8_555_952],
    extraPerPerson: 999_233, // 8,555,952 − 7,556,719
    livingCostRate: 0.6,
    // 2026 생계급여 기준과 일치한다(1인 820,556 = 2,564,238 × 32%).
    survivalRate: 0.32,
    source:
      "보건복지부 2026년도 기준 중위소득 고시 / 생계비 60%는 서울회생법원 실무 원칙 / 하한 32%는 국민기초생활보장법 생계급여 기준",
  },
};

/** 최신 연도(입력에 연도를 안 주면 이걸 쓴다). */
export const LATEST_YEAR = 2026;

/** 법령·실무준칙 기반 상수. */
export const LAW = {
  /** 최저변제액 구간 경계(채무자회생법 제614조 ②-3). */
  MIN_REPAYMENT_THRESHOLD: 50_000_000,
  /** 총채무 5천만원 **미만**: 채무액 × 5% */
  MIN_REPAYMENT_RATE_UNDER: 0.05,
  /** 총채무 5천만원 **이상**: 채무액 × 3% + 100만원 */
  MIN_REPAYMENT_RATE_OVER: 0.03,
  MIN_REPAYMENT_ADD_OVER: 1_000_000,
  /** 최저변제액 상한 — 총변제액 3천만원을 초과하지 않는 범위에서만 적용된다. */
  MIN_REPAYMENT_CAP: 30_000_000,

  /** 신청 자격: 무담보채무 한도(채무자회생법 제579조 1호). */
  UNSECURED_DEBT_LIMIT: 1_000_000_000,
  /** 신청 자격: 담보채무 한도. */
  SECURED_DEBT_LIMIT: 1_500_000_000,

  /** 변제기간 원칙 36개월(채무자회생법 제611조 ⑤). */
  DEFAULT_MONTHS: 36,
  /** 변제기간 상한 60개월. 이걸 넘는 계획은 인가될 수 없다. */
  MAX_MONTHS: 60,

  /** 추가생계비(교육비) — 미성년 자녀 1인당 월 인정액. 서울회생법원 실무준칙 제405호. */
  EDUCATION_COST_PER_CHILD: 200_000,
} as const;

/**
 * 가구원수별 월 기준 중위소득. 6인까지는 고시표, 7인 이상은 1인당 가산액으로 뻗는다.
 * @param householdSize 가구원수(본인 포함). 1 미만은 1로 본다.
 */
export function medianIncomeFor(std: YearStandards, householdSize: number): number {
  const size = Math.max(1, Math.floor(householdSize));
  const table = std.medianIncome;
  if (size <= table.length) return table[size - 1];
  return table[table.length - 1] + std.extraPerPerson * (size - table.length);
}
