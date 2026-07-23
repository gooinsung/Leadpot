import { useCallback, useEffect, useState } from "react";

/**
 * 테마 관리 훅.
 * - "system": OS 설정을 따름 (data-theme 미지정 → tokens.css의 @media가 적용)
 * - "light" / "dark": 사용자가 수동 고정 (data-theme 지정)
 * 선택값은 localStorage에 저장하여 새로고침 후에도 유지한다.
 */
export type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "leadpot-theme";

function readStored(): Theme {
  if (typeof localStorage === "undefined") return "system";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : "system";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readStored);

  useEffect(() => {
    apply(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    if (next === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  }, []);

  // 순환 토글: system → dark → light → system
  const toggle = useCallback(() => {
    setThemeState((cur) => {
      const next: Theme = cur === "system" ? "dark" : cur === "dark" ? "light" : "system";
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { theme, setTheme, toggle };
}
