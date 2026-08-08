import { useEffect, useMemo, useState } from "react";

/**
 * 목록 전체선택/개별선택 공용 훅 (2026-08-08 사용자 요청 — 액션이 있는 모든 목록에 전체선택).
 *
 * - `ids` = 지금 화면에 보이는 행들(페이징 반영). 전체선택은 **보이는 페이지 기준**이다 —
 *   보이지 않는 것까지 지우는 전체선택은 사고를 만든다.
 * - 목록이 바뀌면(페이지 이동·재조회) 이미 사라진 id 를 선택에서 걷어낸다.
 */
export function useSelection(ids: number[]) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const key = ids.join(",");
  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(ids);
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const allSelected = useMemo(
    () => ids.length > 0 && ids.every((id) => selected.has(id)),
    [ids, selected],
  );

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(ids));
  }

  function clear() {
    setSelected(new Set());
  }

  return { selected, allSelected, toggle, toggleAll, clear, count: selected.size };
}

/**
 * 개별 삭제 API 를 순차 호출하는 일괄 실행기 — 벌크 엔드포인트가 없는 목록(리드폼·랜딩 등)용.
 * 실패해도 멈추지 않고 끝까지 돌린 뒤 성공/실패 수를 돌려준다(부분 성공).
 * DB 가 원격이라 순차 호출이 느릴 수 있지만, 목록 페이지 단위(≤25건)라 감내 가능.
 */
export async function runBulk(ids: number[], run: (id: number) => Promise<unknown>) {
  let ok = 0;
  let fail = 0;
  for (const id of ids) {
    try {
      await run(id);
      ok++;
    } catch {
      fail++;
    }
  }
  return { ok, fail };
}
