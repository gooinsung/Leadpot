import { useCallback, useEffect, useMemo, useState } from "react";
import { listLandings, type LandingSummary } from "../api/client";

/**
 * 리드폼 id → 그 리드폼을 연결한 랜딩 목록. 랜딩 목록(요약의 formIds)으로 계산한다.
 * 실패하면 `loaded` 가 false 로 남는다 — 화면은 '확인 불가'로 두고 막지 않는다.
 */
export function useFormUsage() {
  const [landings, setLandings] = useState<LandingSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    listLandings()
      .then((l) => {
        setLandings(l);
        setLoaded(true);
      })
      .catch(() => setLoaded(false));
  }, []);

  useEffect(refresh, [refresh]);

  const byForm = useMemo(() => {
    const m = new Map<number, LandingSummary[]>();
    for (const l of landings) {
      for (const fid of l.formIds ?? []) {
        const arr = m.get(fid);
        if (arr) arr.push(l);
        else m.set(fid, [l]);
      }
    }
    return m;
  }, [landings]);

  const usageOf = useCallback((formId: number) => byForm.get(formId) ?? [], [byForm]);
  return { loaded, usageOf, refresh };
}

/** 삭제 확인 문구에 붙일 경고 — 사용 중인 랜딩이 있으면 이름을 나열한다. */
export function usageWarning(landings: LandingSummary[]): string {
  if (landings.length === 0) return "";
  const names = landings.slice(0, 5).map((l) => `· ${l.title}${l.status === "published" ? " (공개)" : ""}`).join("\n");
  const more = landings.length > 5 ? `\n외 ${landings.length - 5}개` : "";
  return `\n\n⚠️ 이 리드폼을 쓰는 랜딩이 ${landings.length}개 있어요. 삭제하면 그 랜딩에서 폼이 사라집니다.\n${names}${more}`;
}
