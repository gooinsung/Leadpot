import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type RowMenuItem = {
  label: string;
  onClick: () => void;
  /** 되돌리기 어려운 항목(삭제 등) — 빨간색 + 구분선 위쪽에 모아 놓는다. */
  danger?: boolean;
  title?: string;
};

/**
 * 목록 행의 '⋯ 더보기' 메뉴 (U4).
 *
 * 목록 한 행에 버튼이 여러 개 늘어서면 훑기 어렵다. 자주 쓰는 것만 밖에 두고
 * 나머지는 이 메뉴로 접는다.
 *
 * **포털로 띄우는 이유**: 표를 감싼 `.card-table` 이 `overflow: hidden` 이라
 * 행 안에서 그린 드롭다운은 잘린다. `document.body` 에 `position: fixed` 로
 * 띄우고 버튼 위치에 맞춰 좌표를 잡는다.
 */
export function RowMenu({ items, label = "더보기" }: { items: RowMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 버튼 아래에 맞춰 띄우되, 화면 아래로 넘치면 버튼 위로 올린다.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const h = menuRef.current?.offsetHeight ?? 0;
    const below = r.bottom + 6;
    const flip = h > 0 && below + h > window.innerHeight - 8;
    setPos({ top: flip ? Math.max(8, r.top - 6 - h) : below, right: Math.max(8, window.innerWidth - r.right) });
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    // 고정 위치라 스크롤·리사이즈하면 어긋난다 → 닫는다.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const safe = items.filter((i) => !i.danger);
  const danger = items.filter((i) => i.danger);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`btn btn-ghost btn-sm row-menu-btn${open ? " on" : ""}`}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="row-menu"
            role="menu"
            style={{ top: pos?.top ?? -9999, right: pos?.right ?? 0 }}
          >
            {safe.map((it) => (
              <MenuItem key={it.label} item={it} onDone={() => setOpen(false)} />
            ))}
            {danger.length > 0 && safe.length > 0 && <div className="row-menu-sep" />}
            {danger.map((it) => (
              <MenuItem key={it.label} item={it} onDone={() => setOpen(false)} />
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

function MenuItem({ item, onDone }: { item: RowMenuItem; onDone: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`row-menu-item${item.danger ? " danger" : ""}`}
      title={item.title}
      onClick={() => {
        onDone();
        item.onClick();
      }}
    >
      {item.label}
    </button>
  );
}
