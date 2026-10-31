import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { TagMode } from "../lib/listFilter";

/** 태그 묶음 검색 조건(리드폼·랜딩 공용 태그). */
export interface TagFilterValue {
  pool: string[];
  selected: string[];
  mode: TagMode;
  onChange: (selected: string[], mode: TagMode) => void;
}

/** 태그 하나의 상태 — 체크 표시용(some: 일부만 달림, 지금은 쓰지 않지만 패널은 지원). */
export type TagState = "all" | "some" | "none";

/** 태그 최대 길이(백엔드 ContentTags.MAX_LENGTH 와 같게). */
const MAX_TAG_LENGTH = 30;

/**
 * 태그 고르기 패널 — 새 태그 입력 + 이미 쓰는 태그 체크박스(리드폼·랜딩 공용 후보).
 * 체크박스를 누르는 즉시 onToggle 이 불리고, 저장은 부르는 쪽이 한다.
 */
export function TagPanel({
  pool,
  state,
  onToggle,
  busy,
}: {
  pool: string[];
  state: (tag: string) => TagState;
  onToggle: (tag: string, on: boolean) => void;
  busy?: boolean;
}) {
  const [input, setInput] = useState("");
  const [extra, setExtra] = useState<string[]>([]); // 방금 새로 만든 태그(후보에 아직 없는 것)
  const all = [...new Set([...pool, ...extra])].sort((a, b) => a.localeCompare(b, "ko"));
  const q = input.trim();
  const shown = q ? all.filter((t) => t.toLowerCase().includes(q.toLowerCase())) : all;

  function add() {
    const v = q.slice(0, MAX_TAG_LENGTH);
    setInput("");
    if (!v) return;
    if (!all.includes(v)) setExtra((x) => [...x, v]);
    if (state(v) !== "all") onToggle(v, true);
  }

  return (
    <div className="tag-panel">
      <div className="tag-panel-add">
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="새 태그 입력 또는 검색"
          maxLength={MAX_TAG_LENGTH}
          aria-label="태그 입력"
          autoFocus
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={add} disabled={!q || busy}>
          추가
        </button>
      </div>
      {shown.length === 0 ? (
        <p className="tag-panel-empty">{all.length === 0 ? "아직 만든 태그가 없습니다. 위에 입력해 추가하세요." : "검색 결과가 없습니다. 엔터로 새로 추가하세요."}</p>
      ) : (
        <ul className="tag-panel-list">
          {shown.map((t) => {
            const s = state(t);
            return (
              <li key={t}>
                <label>
                  <input
                    type="checkbox"
                    checked={s === "all"}
                    ref={(el) => {
                      if (el) el.indeterminate = s === "some";
                    }}
                    disabled={busy}
                    onChange={() => onToggle(t, s !== "all")}
                  />
                  <span>{t}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * 버튼 + 떠 있는 패널. 표(.card-table) 안에서도 잘리지 않게 position: fixed 로 버튼 아래에 띄운다.
 * 바깥을 누르거나 Esc·스크롤하면 닫힌다.
 */
export function Popover({
  button,
  buttonClassName = "btn btn-ghost btn-sm",
  buttonTitle,
  children,
}: {
  button: ReactNode;
  buttonClassName?: string;
  buttonTitle?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setPos({ top: r.bottom + 4, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // 패널 안(목록) 스크롤은 무시하고, 페이지가 움직일 때만 닫는다(fixed 라 위치가 어긋난다).
    const onScroll = (e: Event) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={buttonClassName}
        title={buttonTitle}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {button}
      </button>
      {open && pos && (
        <div
          ref={panelRef}
          className="popover-panel"
          style={{ top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </>
  );
}

/** 태그 칩 나열(읽기 전용). */
export function TagChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <span className="tag-chips">
      {tags.map((t) => (
        <span key={t} className="tag-chip">
          {t}
        </span>
      ))}
    </span>
  );
}

/**
 * 리드폼·랜딩 하나의 태그 편집 — 칩 + [태그] 버튼(누르면 패널). 체크할 때마다 바로 저장한다.
 * save 가 실패하면 원래대로 되돌린다.
 */
export function TagEditor({
  tags,
  pool,
  save,
}: {
  tags: string[];
  pool: string[];
  save: (next: string[]) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  async function toggle(tag: string, on: boolean) {
    const next = on ? [...tags, tag] : tags.filter((t) => t !== tag);
    setBusy(true);
    try {
      await save(next);
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="tag-editor">
      <TagChips tags={tags} />
      <Popover button={tags.length ? "✎ 태그" : "+ 태그"} buttonClassName="btn btn-ghost btn-sm tag-edit-btn" buttonTitle="태그 달기·떼기">
        <TagPanel pool={pool} state={(t) => (tags.includes(t) ? "all" : "none")} onToggle={toggle} busy={busy} />
      </Popover>
    </span>
  );
}

/** [태그 ▾] — 체크한 태그로 거르고, '모두 포함'(AND)·'하나라도'(OR)를 고른다. */
export function TagFilterButton({ f, className = "input list-filter-select" }: { f: TagFilterValue; className?: string }) {
  const n = f.selected.length;
  function toggle(tag: string) {
    f.onChange(f.selected.includes(tag) ? f.selected.filter((t) => t !== tag) : [...f.selected, tag], f.mode);
  }
  return (
    <Popover
      button={n > 0 ? `태그 ${n} · ${f.mode === "and" ? "AND" : "OR"} ▾` : "태그 ▾"}
      buttonClassName={`${className} list-filter-tags${n > 0 ? " on" : ""}`}
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
