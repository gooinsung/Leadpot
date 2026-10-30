import { useEffect, useState, type KeyboardEvent } from "react";
import { LIST_SORT_LABEL, type ListSort } from "../lib/listFilter";

export interface ListFilterSelect {
  /** 접근성 라벨(화면에는 첫 옵션 '전체 …' 가 라벨 역할을 한다). */
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** 첫 항목은 '전체' (value ""). */
  options: { value: string; label: string }[];
}

/**
 * 리드폼·랜딩 목록 위의 검색·필터·정렬 줄.
 * 거른 결과 수를 함께 보여주고, 조건이 하나라도 걸리면 [초기화] 가 나온다.
 *
 * 검색어는 입력할 때마다가 아니라 [검색] 버튼·엔터로 확정한다(2026-10-30). 글자마다 주소(?q=)를
 * 바꾸면 한글 조합(IME) 중에 입력값이 되돌려 써져 자모가 깨지고 목록도 매번 다시 걸러져 버벅였다.
 * 입력 중인 값은 이 컴포넌트 안에만 두고, 확정할 때만 onQuery 로 올린다.
 */
export function ListFilterBar({
  query,
  onQuery,
  placeholder,
  selects,
  sort,
  onSort,
  sorts,
  shown,
  total,
  onReset,
}: {
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  selects: ListFilterSelect[];
  sort: ListSort;
  onSort: (s: ListSort) => void;
  sorts: ListSort[];
  /** 검색·필터를 거친 개수. */
  shown: number;
  /** 폴더 안 전체 개수. */
  total: number;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(query);
  // 초기화·뒤로가기 등으로 확정된 검색어가 바뀌면 입력창도 맞춘다.
  useEffect(() => {
    setDraft(query);
  }, [query]);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // 한글 조합 중 엔터도 그대로 확정한다 — 브라우저에 따라 엔터가 두 번 들어와도 같은 값이라 무해하다.
    if (e.key === "Enter") onQuery(e.currentTarget.value.trim());
  }

  const active = query.trim() !== "" || selects.some((s) => s.value !== "");
  return (
    <div className="list-filter">
      <div className="list-filter-search">
        <input
          className="input"
          type="search"
          enterKeyHint="search"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            // 입력창을 비우면(✕ 버튼 포함) 바로 전체 목록으로 돌아간다.
            if (e.target.value === "" && query !== "") onQuery("");
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="검색어"
        />
        <button type="button" className="btn btn-primary" onClick={() => onQuery(draft.trim())}>
          검색
        </button>
      </div>
      {selects.map((s) => (
        <select
          key={s.label}
          className="input list-filter-select"
          value={s.value}
          onChange={(e) => s.onChange(e.target.value)}
          aria-label={s.label}
        >
          {s.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
      <select
        className="input list-filter-select"
        value={sort}
        onChange={(e) => onSort(e.target.value as ListSort)}
        aria-label="정렬"
      >
        {sorts.map((s) => (
          <option key={s} value={s}>
            {LIST_SORT_LABEL[s]}
          </option>
        ))}
      </select>
      {active && (
        <span className="list-filter-count">
          {total}개 중 <b>{shown}</b>개
          <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>
            초기화
          </button>
        </span>
      )}
    </div>
  );
}
