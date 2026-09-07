import { debtReliefCalculator } from "./debtRelief/definition";
import type { CalculatorDef } from "./types";

/**
 * 리드팟 계산기 목록.
 *
 * **계산기를 추가하는 유일한 지점이다** — 정의 파일을 만들어 여기 배열에 넣으면
 * 리드폼 만들기 화면의 종류 선택과 공개 폼 렌더러에 자동으로 나타난다(화면 코드 수정 불필요).
 */
export const CALCULATORS: CalculatorDef[] = [debtReliefCalculator];

/** 블록에 저장된 `calcKey` 로 정의를 찾는다. 없는 키(삭제된 계산기)는 null. */
export function findCalculator(key: string | null | undefined): CalculatorDef | null {
  if (!key) return null;
  return CALCULATORS.find((c) => c.key === key) ?? null;
}
