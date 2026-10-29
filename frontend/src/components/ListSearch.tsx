/**
 * 목록 페이지 공통 검색 입력. 화면에 받아둔 목록을 바로 거른다(서버 왕복 없음) —
 * 일치 규칙은 {@link ../lib/search.matchesSearch}.
 */
export function ListSearch({
  value,
  onChange,
  placeholder = "검색",
  resultCount,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** 검색어가 있을 때 옆에 보여줄 결과 수. */
  resultCount?: number;
}) {
  return (
    <div className="list-search">
      <span className="list-search-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <input
        className="input"
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onChange("");
        }}
      />
      {value.trim() && resultCount !== undefined && <span className="list-search-count">{resultCount}개</span>}
    </div>
  );
}
