import { useEffect, useMemo, useRef, useState } from "react";

export interface SearchableOption {
  value: number;
  label: string;
}

/**
 * 검색되는 드롭다운. 입력칸에 글자를 치면 목록이 걸러지고, ↑↓·Enter·Esc 로 고를 수 있다.
 * 항목이 많은 선택(예: 랜딩 편집기의 '연결할 리드폼')에서 일반 &lt;select&gt; 대신 쓴다.
 */
export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = "선택…",
}: {
  value: number | null;
  options: SearchableOption[];
  onChange: (value: number | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function openList() {
    setOpen(true);
    setQuery("");
    const idx = options.findIndex((o) => o.value === value);
    setActive(idx >= 0 ? idx : 0);
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  function pick(o: SearchableOption) {
    onChange(o.value);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      openList();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) pick(filtered[active]);
    } else if (e.key === "Escape") {
      close();
    }
  }

  return (
    <div className="ss-root" ref={rootRef}>
      <input
        className="input ss-input"
        value={open ? query : selected?.label ?? ""}
        placeholder={open ? (selected?.label ?? "검색…") : placeholder}
        onFocus={openList}
        onClick={() => !open && openList()}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          if (!open) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      <span className="ss-caret" aria-hidden="true">▾</span>
      {open && (
        <ul className="ss-list" role="listbox" ref={listRef}>
          {filtered.length === 0 ? (
            <li className="ss-empty">검색 결과가 없습니다</li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                className={`ss-option${i === active ? " active" : ""}${o.value === value ? " selected" : ""}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
