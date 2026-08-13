import { describe, expect, it } from "vitest";

import { calcDebtRelief, minRepaymentFor } from "./index";
import { LAW, YEAR_STANDARDS, medianIncomeFor } from "./standards";

/**
 * 개인회생 탕감액 계산기 테스트.
 * 금액은 2026년 기준 중위소득(보건복지부 고시)으로 손계산한 값을 그대로 박아 검증한다 —
 * 상수표가 잘못 바뀌면 여기서 먼저 깨져야 한다.
 */

const MEDIAN_1 = 2_564_238;
const LIVING_1 = 1_538_543; // 2,564,238 × 60%
const MEDIAN_3 = 5_359_036;
const LIVING_3 = 3_215_422; // 5,359,036 × 60%

describe("기준값(standards)", () => {
  it("2026년 1인·3인 가구 생계비가 고시표의 60%와 일치한다", () => {
    const std = YEAR_STANDARDS[2026];
    expect(medianIncomeFor(std, 1)).toBe(MEDIAN_1);
    expect(Math.round(medianIncomeFor(std, 1) * std.livingCostRate)).toBe(LIVING_1);
    expect(medianIncomeFor(std, 3)).toBe(MEDIAN_3);
    expect(Math.round(medianIncomeFor(std, 3) * std.livingCostRate)).toBe(LIVING_3);
  });

  it("7인 이상 가구는 1인당 가산액으로 뻗는다", () => {
    const std = YEAR_STANDARDS[2026];
    expect(medianIncomeFor(std, 6)).toBe(8_555_952);
    expect(medianIncomeFor(std, 7)).toBe(8_555_952 + 999_233);
    expect(medianIncomeFor(std, 9)).toBe(8_555_952 + 999_233 * 3);
  });

  it("가구원수 0·음수는 1인으로 본다", () => {
    const std = YEAR_STANDARDS[2026];
    expect(medianIncomeFor(std, 0)).toBe(MEDIAN_1);
    expect(medianIncomeFor(std, -5)).toBe(MEDIAN_1);
  });
});

describe("최저변제액(제614조 ②-3)", () => {
  it("5천만원 미만은 5%", () => {
    expect(minRepaymentFor(30_000_000)).toBe(1_500_000);
    expect(minRepaymentFor(49_999_999)).toBe(2_500_000);
  });

  it("5천만원 이상은 3% + 100만원", () => {
    expect(minRepaymentFor(50_000_000)).toBe(2_500_000);
    expect(minRepaymentFor(100_000_000)).toBe(4_000_000);
  });

  it("상한 3천만원을 넘지 않는다", () => {
    // 10억 → 3천만 + 100만 = 3,100만이지만 상한에 걸린다
    expect(minRepaymentFor(1_000_000_000)).toBe(LAW.MIN_REPAYMENT_CAP);
  });

  it("채무액보다 많이 나오지 않는다", () => {
    expect(minRepaymentFor(100_000)).toBe(5_000);
  });
});

describe("가용소득이 지배하는 일반 케이스", () => {
  const r = calcDebtRelief({ totalDebt: 50_000_000, monthlyIncome: 2_500_000, assets: 0, securedDebt: 0 });

  it("생계비·가용소득을 법정 정의대로 계산한다", () => {
    expect(r.eligible).toBe(true);
    expect(r.householdSize).toBe(1);
    expect(r.baseLivingCost).toBe(LIVING_1);
    expect(r.livingCost).toBe(LIVING_1);
    expect(r.disposableIncome).toBe(2_500_000 - LIVING_1); // 961,457
  });

  it("총변제액 = 가용소득 × 36개월", () => {
    expect(r.repaymentMonths).toBe(36);
    expect(r.totalRepayment).toBe(961_457 * 36); // 34,612,452
    expect(r.bindingConstraint).toBe("DISPOSABLE_INCOME");
    expect(r.monthlyRepayment).toBe(961_457);
  });

  it("탕감액·탕감률이 맞다", () => {
    expect(r.reliefAmount).toBe(50_000_000 - 34_612_452); // 15,387,548
    expect(r.reliefRate).toBe(30.8);
  });

  it("재산·담보채무를 명시했으므로 가정 플래그가 없다", () => {
    expect(r.assumptions).not.toContain("ASSETS_ASSUMED_ZERO");
    expect(r.assumptions).not.toContain("SECURED_DEBT_NOT_SPLIT");
  });
});

describe("최저변제액이 지배하는 저소득 케이스", () => {
  // 월소득 160만 / 1인 → 가용소득 61,457원. 36개월로는 최저변제액 400만원을 못 채운다.
  const r = calcDebtRelief({ totalDebt: 100_000_000, monthlyIncome: 1_600_000, assets: 0, securedDebt: 0 });

  it("최저변제액이 하한으로 작동한다", () => {
    expect(r.disposableIncome).toBe(61_457);
    expect(r.minRepayment).toBe(4_000_000);
    expect(r.bindingConstraint).toBe("MIN_REPAYMENT");
    expect(r.totalRepayment).toBe(4_000_000);
  });

  it("60개월로도 하한을 못 채우면 경고를 남긴다", () => {
    // 4,000,000 / 61,457 ≈ 65.1개월 > 60개월 상한
    expect(r.repaymentMonths).toBe(60);
    expect(r.assumptions).toContain("PERIOD_EXTENDED");
    expect(r.assumptions).toContain("FLOOR_EXCEEDS_CAPACITY");
  });

  it("탕감률이 96%로 나온다", () => {
    expect(r.reliefAmount).toBe(96_000_000);
    expect(r.reliefRate).toBe(96);
  });
});

describe("청산가치가 지배하는 케이스", () => {
  // 3인 가구, 월 360만, 채무 8천만, 재산 1,500만
  const r = calcDebtRelief({
    totalDebt: 80_000_000,
    monthlyIncome: 3_600_000,
    dependents: 2,
    assets: 15_000_000,
    securedDebt: 0,
  });

  it("청산가치가 최저변제액보다 크면 청산가치가 하한이다", () => {
    expect(r.disposableIncome).toBe(3_600_000 - LIVING_3); // 384,578
    expect(r.minRepayment).toBe(3_400_000);
    expect(r.liquidationValue).toBe(15_000_000);
    expect(r.bindingConstraint).toBe("LIQUIDATION_VALUE");
  });

  it("청산가치를 맞추려 변제기간을 늘린다(월변제금은 가용소득을 넘지 않는다)", () => {
    // 15,000,000 / 384,578 = 39.004 → 40개월
    expect(r.repaymentMonths).toBe(40);
    expect(r.totalRepayment).toBe(384_578 * 40); // 15,383,120
    expect(r.monthlyRepayment).toBe(384_578);
    expect(r.assumptions).toContain("PERIOD_EXTENDED");
    expect(r.assumptions).not.toContain("FLOOR_EXCEEDS_CAPACITY");
  });

  it("청산가치 때문에 탕감률이 낮아진다", () => {
    expect(r.reliefAmount).toBe(80_000_000 - 15_383_120);
    expect(r.reliefRate).toBe(80.8);
  });
});

describe("자격 게이트", () => {
  it("소득이 생계비 이하면 개인회생이 아니라 파산 트랙이다", () => {
    const r = calcDebtRelief({ totalDebt: 30_000_000, monthlyIncome: 1_500_000 });
    expect(r.eligible).toBe(false);
    expect(r.ineligibleReason).toBe("NO_DISPOSABLE_INCOME");
    expect(r.disposableIncome).toBeLessThanOrEqual(0);
    // 화면 안내를 위해 생계비 자체는 계산해서 돌려준다
    expect(r.livingCost).toBe(LIVING_1);
  });

  it("생계비와 소득이 정확히 같아도 가용소득 0이므로 불가다", () => {
    const r = calcDebtRelief({ totalDebt: 30_000_000, monthlyIncome: LIVING_1 });
    expect(r.ineligibleReason).toBe("NO_DISPOSABLE_INCOME");
  });

  it("무담보채무 10억 초과는 신청 자격이 없다", () => {
    const r = calcDebtRelief({ totalDebt: 1_000_000_001, monthlyIncome: 5_000_000 });
    expect(r.eligible).toBe(false);
    expect(r.ineligibleReason).toBe("UNSECURED_DEBT_LIMIT");
  });

  it("담보채무 15억 초과는 신청 자격이 없다", () => {
    const r = calcDebtRelief({
      totalDebt: 2_000_000_000,
      securedDebt: 1_500_000_001,
      monthlyIncome: 5_000_000,
    });
    expect(r.eligible).toBe(false);
    expect(r.ineligibleReason).toBe("SECURED_DEBT_LIMIT");
  });

  it("변제 대상 채무가 없으면 계산할 것이 없다", () => {
    const r = calcDebtRelief({ totalDebt: 100_000_000, securedDebt: 100_000_000, monthlyIncome: 5_000_000 });
    expect(r.ineligibleReason).toBe("NO_UNSECURED_DEBT");
  });
});

describe("담보채무 분리", () => {
  it("담보채무는 변제 대상에서 빠진다", () => {
    const r = calcDebtRelief({
      totalDebt: 300_000_000,
      securedDebt: 200_000_000,
      monthlyIncome: 3_000_000,
      assets: 0,
    });
    expect(r.unsecuredDebt).toBe(100_000_000);
    // 탕감률의 분모도 무담보채무다
    expect(r.reliefRate).toBe(Math.round((r.reliefAmount / 100_000_000) * 1000) / 10);
  });

  it("담보채무가 총채무보다 크면 총채무로 잘린다", () => {
    const r = calcDebtRelief({ totalDebt: 50_000_000, securedDebt: 90_000_000, monthlyIncome: 3_000_000 });
    expect(r.ineligibleReason).toBe("NO_UNSECURED_DEBT");
  });
});

describe("추가생계비", () => {
  it("미성년 자녀 교육비가 1인당 20만원 가산된다", () => {
    const r = calcDebtRelief({
      totalDebt: 50_000_000,
      monthlyIncome: 3_000_000,
      dependents: 2,
      minorChildren: 2,
      assets: 0,
    });
    expect(r.livingCost).toBe(LIVING_3 + 400_000);
    expect(r.disposableIncome).toBe(3_000_000 - (LIVING_3 + 400_000));
  });

  it("기본+추가 생계비는 중위소득 100%를 넘지 못한다", () => {
    const r = calcDebtRelief({
      totalDebt: 50_000_000,
      monthlyIncome: 3_000_000,
      extraLivingCost: 2_000_000, // 1,538,543 + 2,000,000 = 3,538,543 > 중위소득
      assets: 0,
    });
    expect(r.livingCost).toBe(MEDIAN_1);
    expect(r.assumptions).toContain("EXTRA_LIVING_COST_CAPPED");
  });

  it("추가생계비를 안 넣으면 과소추정 플래그가 붙는다", () => {
    const r = calcDebtRelief({ totalDebt: 50_000_000, monthlyIncome: 3_000_000, assets: 0 });
    expect(r.assumptions).toContain("EXTRA_LIVING_COST_OMITTED");
  });
});

describe("배우자 소득 안분", () => {
  it("배우자 소득이 있으면 생계비를 소득 비율로 안분한다", () => {
    const r = calcDebtRelief({
      totalDebt: 50_000_000,
      monthlyIncome: 3_000_000,
      spouseIncome: 2_000_000,
      dependents: 1,
      assets: 0,
    });
    // 2인 가구 생계비 2,519,575 × (300만 / 500만) = 1,511,745
    expect(r.livingCost).toBe(1_511_745);
    expect(r.disposableIncome).toBe(3_000_000 - 1_511_745);
    expect(r.assumptions).toContain("LIVING_COST_PRORATED");
  });
});

describe("전액 변제 = 회생 실익 없음", () => {
  const r = calcDebtRelief({ totalDebt: 30_000_000, monthlyIncome: 5_000_000, assets: 0, securedDebt: 0 });

  it("채무를 넘겨 갚지 않고 기간을 줄인다", () => {
    expect(r.totalRepayment).toBe(30_000_000);
    expect(r.reliefAmount).toBe(0);
    expect(r.reliefRate).toBe(0);
    expect(r.bindingConstraint).toBe("FULL_DEBT");
    expect(r.assumptions).toContain("NO_RELIEF");
    // 30,000,000 / 3,461,457 = 8.67 → 9개월
    expect(r.repaymentMonths).toBe(9);
  });
});

describe("입력 방어", () => {
  it("재산·담보채무 미입력은 0으로 가정하고 플래그를 남긴다", () => {
    const r = calcDebtRelief({ totalDebt: 50_000_000, monthlyIncome: 2_500_000 });
    expect(r.liquidationValue).toBe(0);
    expect(r.unsecuredDebt).toBe(50_000_000);
    expect(r.assumptions).toContain("ASSETS_ASSUMED_ZERO");
    expect(r.assumptions).toContain("SECURED_DEBT_NOT_SPLIT");
  });

  it("음수·NaN 입력은 0으로 정리된다", () => {
    const r = calcDebtRelief({
      totalDebt: 50_000_000,
      monthlyIncome: 2_500_000,
      assets: -1000,
      dependents: -3,
      minorChildren: -2,
      extraLivingCost: Number.NaN,
    });
    expect(r.liquidationValue).toBe(0);
    expect(r.householdSize).toBe(1);
    expect(r.livingCost).toBe(LIVING_1);
  });

  it("변제기간은 60개월을 넘겨 요청해도 60으로 잘린다", () => {
    const r = calcDebtRelief({
      totalDebt: 200_000_000,
      monthlyIncome: 2_500_000,
      repaymentMonths: 120,
      assets: 0,
    });
    expect(r.repaymentMonths).toBe(60);
  });

  it("모르는 연도를 주면 최신 기준값으로 계산한다", () => {
    const r = calcDebtRelief({ totalDebt: 50_000_000, monthlyIncome: 2_500_000, year: 1999 });
    expect(r.year).toBe(2026);
    expect(r.baseLivingCost).toBe(LIVING_1);
  });
});
