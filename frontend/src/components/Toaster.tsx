import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { dismissToast, subscribeToasts, type ToastItem } from "../lib/toast";

const ICON: Record<ToastItem["kind"], string> = {
  success: "✓",
  error: "!",
  info: "i",
};

/** 토스트를 화면 구석에 쌓아 보여준다. 앱에 한 번만 마운트한다(App.tsx). */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setItems), []);

  if (items.length === 0) return null;

  return createPortal(
    <div className="toaster" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.kind}`}
          // 실패는 화면 낭독기가 즉시 읽도록 alert 로.
          role={t.kind === "error" ? "alert" : "status"}
        >
          <span className="toast-icon" aria-hidden="true">
            {ICON[t.kind]}
          </span>
          <span className="toast-msg">{t.message}</span>
          <button type="button" className="toast-x" aria-label="닫기" onClick={() => dismissToast(t.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
