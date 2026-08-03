import { useCallback, useEffect, useState } from "react";

/**
 * 행 밀도 훅 (U7 · Cockpit).
 *
 * Cockpit 은 "촘촘한 표 + 행 높이 토글"이 정의다. 리드를 하루에 수백 건 훑는
 * 마케터에게는 한 화면에 더 많이 보이는 쪽이 유리하지만, 사람마다 편한 밀도가
 * 다르므로 바꿀 수 있게 둔다. 기본은 **촘촘하게**(밀도 우선 결정).
 *
 * `<html data-density>` 를 바꾸면 tokens 의 --row-py/--row-px 가 따라 바뀌고,
 * 표·행 목록이 한꺼번에 반응한다.
 */
export type Density = "compact" | "cozy";

const STORAGE_KEY = "leadpot-density";

function readStored(): Density {
  if (typeof localStorage === "undefined") return "compact";
  return localStorage.getItem(STORAGE_KEY) === "cozy" ? "cozy" : "compact";
}

export function useDensity() {
  const [density, setDensityState] = useState<Density>(readStored);

  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
  }, [density]);

  const toggle = useCallback(() => {
    setDensityState((cur) => {
      const next: Density = cur === "compact" ? "cozy" : "compact";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { density, toggle };
}
