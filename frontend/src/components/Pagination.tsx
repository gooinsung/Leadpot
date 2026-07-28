import { useEffect, useState } from "react";

/** 페이지당 개수 선택지. -1 = 전체(all). */
export const PAGE_SIZE_OPTIONS: { value: number; label: string }[] = [
  { value: 5, label: "5개" },
  { value: 10, label: "10개" },
  { value: 15, label: "15개" },
  { value: 20, label: "20개" },
  { value: 25, label: "25개" },
  { value: -1, label: "전체" },
];

/**
 * 로우데이터 목록용 클라이언트 페이징 훅.
 * items(필터 적용 후 전체)를 받아 현재 페이지 조각(pageItems)과 컨트롤 상태를 돌려준다.
 * 필터가 바뀌어 total 이 변하거나 페이지당 개수를 바꾸면 1페이지로 리셋한다.
 */
export function usePaging<T>(items: T[], initialSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  const total = items.length;
  const pages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [total, pageSize]);

  const safePage = Math.min(page, pages);
  const pageItems = pageSize === -1 ? items : items.slice((safePage - 1) * pageSize, safePage * pageSize);

  return { page: safePage, pageSize, setPage, setPageSize, total, pages, pageItems };
}

interface PaginationProps {
  total: number;
  page: number;
  pages: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
  /** 단위 라벨(기본 "건"). */
  unit?: string;
}

/** 목록 하단 페이징 바(총 개수 · 페이지당 개수 · 이전/다음). */
export function Pagination({ total, page, pages, pageSize, onPage, onPageSize, unit = "건" }: PaginationProps) {
  if (total === 0) return null;
  const from = pageSize === -1 ? 1 : (page - 1) * pageSize + 1;
  const to = pageSize === -1 ? total : Math.min(page * pageSize, total);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        marginTop: 14,
      }}
    >
      <span className="dash-sub" style={{ fontSize: 13 }}>
        총 {total.toLocaleString()}{unit} 중 {from.toLocaleString()}–{to.toLocaleString()}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <select
          className="input"
          style={{ width: 100 }}
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          aria-label="페이지당 개수"
        >
          {PAGE_SIZE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {pageSize !== -1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>
              ← 이전
            </button>
            <span className="dash-sub" style={{ fontSize: 13, minWidth: 64, textAlign: "center" }}>
              {page} / {pages}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => onPage(page + 1)} disabled={page >= pages}>
              다음 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
