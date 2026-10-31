import { useCallback, useEffect, useMemo, useState } from "react";
import type { SetURLSearchParams } from "react-router-dom";
import { listContentTags } from "../api/client";
import type { TagMode } from "./listFilter";

/** 태그 후보(리드폼·랜딩 공용). 태그를 바꾼 뒤 refresh 로 다시 받는다(지운 태그가 빠지도록). */
export function useTagPool() {
  const [pool, setPool] = useState<string[]>([]);
  const refresh = useCallback(() => {
    listContentTags()
      .then(setPool)
      .catch(() => {
        /* 후보 로드 실패는 무시 — 태그 입력은 계속 된다 */
      });
  }, []);
  useEffect(refresh, [refresh]);
  return { pool, refresh };
}

/** 태그 묶음 검색 조건 — 주소(?tag=a&tag=b&tagMode=or)에 둔다(다른 검색 조건과 같이 뒤로 와도 유지). */
export function useTagFilterParams(params: URLSearchParams, setParams: SetURLSearchParams) {
  // 내용이 같으면 같은 배열을 쓴다(목록 거르기 useMemo 의존성용) — 그래서 문자열 키로 한 번 접는다.
  const key = params.getAll("tag").join("\u0000");
  const selected = useMemo(() => (key ? key.split("\u0000") : []), [key]);
  const mode: TagMode = params.get("tagMode") === "or" ? "or" : "and";
  function set(next: string[], nextMode: TagMode) {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete("tag");
        next.forEach((t) => p.append("tag", t));
        if (nextMode === "or") p.set("tagMode", "or");
        else p.delete("tagMode");
        return p;
      },
      { replace: true },
    );
  }
  return { selected, mode, set };
}
