import { describe, expect, it } from "vitest";

import { policyFundCalculator as def } from "./definition";
import { findCalculator } from "../registry";

/**
 * 정책자금 매칭 — 계산이 없는 종류. 막는 것은 "흐름이 레퍼런스대로 가는가"와
 * "리드에 엉뚱한 계산 결과 칸이 생기지 않는가"다.
 */
describe("정책자금 매칭", () => {
  it("registry 로 찾을 수 있다", () => {
    expect(findCalculator("policyFund")).toBe(def);
  });

  it("질문을 자동 생성하지 않는다 — 마케터가 직접 만든다", () => {
    expect(def.freeSteps).toBe(true);
    expect(def.inputs).toEqual([]);
  });

  it("연락처 단계 전에 '매칭중' 로딩을 거친다", () => {
    expect(def.preGateLoading?.title).toContain("매칭중");
  });

  it("연락처 단계는 '매칭이 완료되었습니다' 로 시작하고 결과 확인 버튼을 쓴다", () => {
    expect(def.gate.title).toBe("정책자금 매칭이 완료되었습니다!");
    expect(def.gate.highlight).toContain("연락처를 입력해주세요");
    expect(def.gate.submitLabel).toBe("결과 확인하기");
  });

  it("접수 뒤 계산 결과 대신 완료 화면 설정을 쓴다", () => {
    expect(def.noResult).toBe(true);
  });

  it("리드에 계산 결과 칸을 만들지 않는다", () => {
    expect(def.outputLabels).toEqual([]);
    expect(def.toAnswers(def.run({}))).toEqual([]);
  });
});
