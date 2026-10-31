import { useEffect, useState, type KeyboardEvent } from "react";
import { LIST_SORT_LABEL, type ListSort, type TagMode } from "../lib/listFilter";
import { Popover } from "./TagPicker";

export interface ListFilterSelect {
  /** 접근성 라벨(화면에는 첫 옵션 '전체 …' 가 라벨 역할을 한다). */
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** 첫 항목은 '전체' (value ""). */
  options: { value: string; label: string }[];
}

/** 태그 묶음 검색(리드폼·랜딩 공용 태그). 후보가 없으면 버튼을 숨긴다. */
export interface ListTagFilter {
  pool: string[];
  selected: string[];
  mode: TagMode;
  onChange: (selected: string[], mode: TagMode) => void;
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
  tagFilter,
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
  tagFilter?: ListTagFilter;
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

  const active =
    query.trim() !== "" || selects.some((s) => s.value !== "") || (tagFilter?.selected.length ?? 0) > 0;
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
      {tagFilter && tagFilter.pool.length > 0 && <TagFilterButton f={tagFilter} />}
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

/** [태그 ▾] — 체크한 태그로 거르고, '모두 포함'(AND)·'하나라도'(OR)를 고른다. */
function TagFilterButton({ f }: { f: ListTagFilter }) {
  const n = f.selected.length;
  function toggle(tag: string) {
    f.onChange(f.selected.includes(tag) ? f.selected.filter((t) => t !== tag) : [...f.selected, tag], f.mode);
  }
  return (
    <Popover
      button={n > 0 ? `태그 ${n} · ${f.mode === "and" ? "AND" : "OR"} ▾` : "태그 ▾"}
      buttonClassName={`input list-filter-select list-filter-tags${n > 0 ? " on" : ""}`}
      buttonTitle="태그로 거르기"
    >
      <div className="tag-panel">
        <div className="tag-mode" role="radiogroup" aria-label="태그 검색 방식">
          {(["and", "or"] as TagMode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={f.mode === m}
              className={f.mode === m ? "on" : ""}
              onClick={() => f.onChange(f.selected, m)}
            >
              {m === "and" ? "모두 포함 (AND)" : "하나라도 (OR)"}
            </button>
          ))}
        </div>
        <ul className="tag-panel-list">
          {f.pool.map((t) => (
            <li key={t}>
              <label>
                <input type="checkbox" checked={f.selected.includes(t)} onChange={() => toggle(t)} />
                <span>{t}</span>
              </label>
            </li>
          ))}
        </ul>
        {n > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => f.onChange([], f.mode)}>
            태그 선택 해제
          </button>
        )}
      </div>
    </Popover>
  );
}
