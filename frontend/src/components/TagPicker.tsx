import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** 태그 하나의 상태 — 여러 개를 골라 한 번에 달 때는 '일부만 달림'(some)이 생긴다. */
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

/**
 * 목록에서 여러 개를 골라 태그 달기·떼기. 체크 상태는 고른 것 전체 기준(일부만 달렸으면 '−').
 * 체크하면 전부에 달고, 해제하면 전부에서 뗀다.
 */
export function BulkTagButton<T extends { id: number; tags: string[] }>({
  items,
  pool,
  update,
  onDone,
}: {
  items: T[];
  pool: string[];
  update: (id: number, tags: string[]) => Promise<{ tags: string[] }>;
  onDone: (changed: Map<number, string[]>, fail: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  function state(tag: string): TagState {
    const n = items.filter((x) => x.tags.includes(tag)).length;
    return n === 0 ? "none" : n === items.length ? "all" : "some";
  }
  async function toggle(tag: string, on: boolean) {
    setBusy(true);
    const changed = new Map<number, string[]>();
    let fail = 0;
    for (const x of items) {
      const has = x.tags.includes(tag);
      if (has === on) continue;
      try {
        const r = await update(x.id, on ? [...x.tags, tag] : x.tags.filter((t) => t !== tag));
        changed.set(x.id, r.tags);
      } catch {
        fail++;
      }
    }
    setBusy(false);
    onDone(changed, fail);
  }
  return (
    <Popover button="태그 달기·떼기" buttonTitle="고른 항목에 태그를 한 번에 달거나 뗍니다">
      <TagPanel pool={pool} state={state} onToggle={toggle} busy={busy} />
    </Popover>
  );
}
