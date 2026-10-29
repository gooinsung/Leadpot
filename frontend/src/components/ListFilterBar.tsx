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
  const active = query.trim() !== "" || selects.some((s) => s.value !== "");
  return (
    <div className="list-filter">
      <input
        className="input list-filter-search"
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={placeholder}
        aria-label="검색"
      />
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
