import { describe, expect, it } from "vitest";

import { debtReliefCalculator as def } from "./definition";
import { CALCULATORS, findCalculator } from "../registry";

/**
 * 계산기 "정의" 계층 테스트 — 계산식 자체는 index.test.ts 가 검증한다.
 * 여기서 막는 것은 **폼·시트·문자와의 접합부가 조용히 깨지는 것**이다.
 */

/** 정상 계산이 나오는 입력(1인 가구·월 250만·채무 5천만·재산 없음). */
const OK_RAW = { totalDebt: "5000", monthlyIncome: "250", dependents: "0", assets: "0", securedDebt: "0" };

describe("계약(다른 계층과의 접합부)", () => {
  it("outputLabels 와 toAnswers 의 label 이 정확히 일치한다", () => {
    // 어긋나면 빌더가 안내한 {{변수}} 가 실제 리드에 없어 문자가 빈칸으로 나간다.
    const labels = def.toAnswers(def.run(OK_RAW)).map((a) => a.label);
    expect(labels).toEqual(def.outputLabels);
  });

  it("결과 답변은 모두 fieldType=calc 로 저장된다", () => {
    expect(def.toAnswers(def.run(OK_RAW)).every((a) => a.fieldType === "calc")).toBe(true);
  });

  it("registry 로 찾을 수 있고 없는 키는 null 이다", () => {
    expect(findCalculator("debtRelief")).toBe(def);
    expect(findCalculator("nope")).toBeNull();
    expect(findCalculator(undefined)).toBeNull();
  });

  it("계산기 key 가 중복되지 않는다", () => {
    const keys = CALCULATORS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("모든 계산기가 면책 문구를 갖는다(강제 노출 대상)", () => {
    expect(CALCULATORS.every((c) => c.disclaimer.trim().length > 0)).toBe(true);
  });

  it("선택형 입력의 선택지는 모두 계산값(value)을 갖는다", () => {
    // value 가 비면 공개 폼이 라벨을 숫자로 읽으려다 0 으로 처리한다.
    for (const input of def.inputs) {
      if (input.answerType !== "single") continue;
      expect(input.options?.length, `${input.key} 선택지 없음`).toBeGreaterThan(0);
      expect(input.options?.every((o) => o.value.trim() !== ""), `${input.key} 선택지 value 누락`).toBe(true);
    }
  });
});

describe("입력 단위 변환", () => {
  it("만원 단위 입력이 원으로 환산된다", () => {
    const view = def.run(OK_RAW);
    // 채무 5000만원 = 5천만원 → 변제 대상 채무 50,000,000원
    expect(view.breakdown.find((b) => b.label === "변제 대상 채무")?.value).toBe("50,000,000원");
    // 월소득 250만원 - 생계비 1,538,543 = 961,457
    expect(view.breakdown.find((b) => b.label === "월 가용소득")?.value).toBe("961,457원");
  });

  it("탕감률을 headlineSub 에서 뽑아 답변으로 저장한다", () => {
    const answers = def.toAnswers(def.run(OK_RAW));
    expect(answers.find((a) => a.label === "예상 탕감률")?.value).toBe("30.8%");
  });
});

describe("미입력과 0을 구분한다", () => {
  it("재산을 안 고르면 '재산 없음 가정' 경고가 붙는다", () => {
    const view = def.run({ totalDebt: "5000", monthlyIncome: "250", dependents: "0" });
    expect(view.warnings.some((w) => w.includes("재산이 없다고 가정"))).toBe(true);
  });

  it("재산을 '거의 없음'(0)으로 고르면 경고가 붙지 않는다", () => {
    const view = def.run(OK_RAW);
    expect(view.warnings.some((w) => w.includes("재산이 없다고 가정"))).toBe(false);
  });
});

describe("계산 불가도 상담으로 이어진다", () => {
  // 월소득 150만 / 1인 → 생계비(153만) 이하 → 개인회생 불가
  const view = def.run({ totalDebt: "3000", monthlyIncome: "150", dependents: "0", assets: "0" });

  it("ok=false 이고 파산을 안내한다", () => {
    expect(view.ok).toBe(false);
    expect(view.notice).toContain("개인파산");
  });

  it("왜 안 되는지 근거를 보여준다", () => {
    expect(view.breakdown.map((b) => b.label)).toContain("갚을 수 있는 여유 금액");
  });

  it("계산 불가일 때도 답변은 저장된다(리드는 살린다)", () => {
    const answers = def.toAnswers(view);
    expect(answers.find((a) => a.label === "예상 탕감액")?.value).toBe("계산 불가");
    // 저장 값에는 화면용 강조 표시(**)가 남지 않아야 한다 — 시트·문자에 그대로 나간다.
    expect(answers.some((a) => a.value.includes("**"))).toBe(false);
  });
});

describe("결과 화면 재료", () => {
  it("탕감액·탕감률·월변제금이 한 줄 요약에 들어간다", () => {
    const view = def.run(OK_RAW);
    expect(view.ok).toBe(true);
    expect(view.headline).toBe("1,538만원");
    expect(view.headlineSub).toContain("탕감률 30.8%");
    expect(view.headlineSub).toContain("36개월");
  });

  it("총 변제금액에 '왜 이 금액인지' 근거가 붙는다", () => {
    const view = def.run(OK_RAW);
    expect(view.breakdown.find((b) => b.label === "총 변제금액")?.hint).toContain("가용소득");
  });

  it("청산가치가 지배하면 근거 문구가 바뀐다", () => {
    // 3인 가구·월 360만·채무 8천만·재산 5천만 → 청산가치가 하한
    const view = def.run({
      totalDebt: "8000", monthlyIncome: "360", dependents: "2", assets: "5000", securedDebt: "0",
    });
    expect(view.breakdown.find((b) => b.label === "총 변제금액")?.hint).toContain("청산가치");
  });
});
