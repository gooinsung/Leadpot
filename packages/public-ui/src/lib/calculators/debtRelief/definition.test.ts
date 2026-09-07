import { describe, expect, it } from "vitest";

import { debtReliefCalculator as def } from "./definition";
import { CALCULATORS, findCalculator } from "../registry";

/**
 * 계산기 "정의" 계층 테스트 — 계산식 자체는 index.test.ts 가 검증한다.
 * 여기서 막는 것은 **폼·시트·문자와의 접합부가 조용히 깨지는 것**이다.
 */

/** 정상 계산이 나오는 입력(1인 가구·월 250만·채무 5천만·재산 없음). */
const OK_RAW = { totalDebt: "5000", monthlyIncome: "250", dependents: "0", assets: "0" };

describe("질문 구성", () => {
  it("질문은 4개다 — 담보대출·미성년자녀는 묻지 않는다(2026-08-13 결정)", () => {
    expect(def.inputs.map((i) => i.key)).toEqual(["totalDebt", "monthlyIncome", "dependents", "assets"]);
  });

  it("담보대출은 1번 질문에서 제외하도록 안내한다", () => {
    // 이 안내가 사라지면 담보대출을 포함해 입력하는 사람이 생겨 탕감액이 과대 추정된다.
    expect(def.inputs[0].description).toContain("주택담보대출은 빼고");
  });

  it("담보대출을 묻지 않으므로 '분리하지 않았다' 경고는 뜨지 않는다", () => {
    // 1번 질문에서 이미 제외했는데 경고가 뜨면 거짓 안내가 된다.
    expect(def.run(OK_RAW).warnings.some((w) => w.includes("담보 대출을 분리하지"))).toBe(false);
  });

  it("추가생계비 미반영 경고는 계속 뜬다(상담 훅)", () => {
    expect(def.run(OK_RAW).warnings.some((w) => w.includes("추가 생계비"))).toBe(true);
  });
});

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
  // 월소득 70만 / 1인 → 생계급여 하한(82만)까지 줄여도 못 갚는다 → 개인회생 불가
  const view = def.run({ totalDebt: "3000", monthlyIncome: "70", dependents: "0", assets: "0" });

  it("ok=false 이고 파산이 유리할 수 있다고 안내한다", () => {
    expect(view.ok).toBe(false);
    expect(view.notice).toContain("개인파산이 유리할 수 있습니다");
  });

  it("안내가 '안 됩니다'로 끝나지 않고 무료 상담으로 이어진다", () => {
    expect(view.notice).toContain("무료 상담");
  });

  it("왜 안 되는지 근거를 보여준다", () => {
    const labels = view.breakdown.map((b) => b.label);
    expect(labels).toContain("월 소득");
    expect(labels).toContain("법정 최소 변제금액");
  });

  it("계산 불가일 때도 답변은 저장된다(리드는 살린다)", () => {
    const answers = def.toAnswers(view);
    expect(answers.find((a) => a.label === "예상 탕감액")?.value).toBe("개인회생 불가");
    expect(answers.find((a) => a.label === "예상 탕감률")?.value).toBe("개인파산 검토 대상");
    // 저장 값에는 화면용 강조 표시(**)가 남지 않아야 한다 — 시트·문자에 그대로 나간다.
    expect(answers.some((a) => a.value.includes("**"))).toBe(false);
  });
});

describe("결과 화면 재료", () => {
  it("탕감률을 가장 크게, 금액을 그 아래에 둔다", () => {
    const view = def.run(OK_RAW);
    expect(view.ok).toBe(true);
    // headline = 탕감률(가장 큰 숫자), headlineSub = 금액
    expect(view.headline).toBe("30.8%");
    expect(view.headlineLabel).toBe("나의 예상 탕감액은?");
    expect(view.headlineSub).toBe("예상 탕감액 1,538만원");
    expect(view.headlineNote).toContain("36개월");
  });

  it("게이트·후속안내 문구가 채워져 있다", () => {
    expect(def.gate.bullets.length).toBeGreaterThan(0);
    expect(def.gate.submitLabel).toContain("무료상담");
    expect(def.followUp).toContain("무료 상담 전화");
  });

  it("게이트에 탕감액이 무엇인지 설명이 있다", () => {
    // 용어를 모르는 사람에게는 숫자만 커도 와닿지 않는다.
    expect(def.gate.explain.title).toContain("탕감액");
    expect(def.gate.explain.body).toContain("갚지 않아도 되는 금액");
  });

  it("빌더 미리보기 예시는 정상 계산되는 값이어야 한다", () => {
    // 여기서 '계산 불가'가 나오면 마케터가 파산 안내 화면을 예시로 보게 된다.
    const view = def.run(def.sampleInput);
    expect(view.ok).toBe(true);
    expect(view.headline).toMatch(/^\d/);
  });

  it("'AI' 라는 표현을 쓰지 않는다(법정 산식 계산이다 · 2026-08-13 결정)", () => {
    const text = [def.name, def.description, def.gate.title, def.gate.highlight, def.gate.submitLabel, def.followUp]
      .concat(def.gate.bullets)
      .join(" ");
    expect(text).not.toMatch(/\bAI\b/i);
  });

  it("총 변제금액에 '왜 이 금액인지' 근거가 붙는다", () => {
    const view = def.run(OK_RAW);
    expect(view.breakdown.find((b) => b.label === "총 변제금액")?.hint).toContain("가용소득");
  });

  it("청산가치가 지배하면 근거 문구가 바뀐다", () => {
    // 3인 가구·월 360만·채무 8천만·재산 5천만 → 청산가치가 하한
    const view = def.run({ totalDebt: "8000", monthlyIncome: "360", dependents: "2", assets: "5000" });
    expect(view.breakdown.find((b) => b.label === "총 변제금액")?.hint).toContain("청산가치");
  });
});
