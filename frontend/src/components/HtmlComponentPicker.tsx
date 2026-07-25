import { useEffect, useState } from "react";
import { getHtmlComponent, listHtmlComponents, type HtmlComponentSummary } from "../api/client";

/**
 * 저장된 HTML 요소(M8)를 골라 현재 HTML에 복사 삽입(스냅샷)하는 셀렉트.
 * 선택 시 해당 요소의 html 을 onInsert 로 전달한다(호출부에서 기존 값에 이어붙임).
 * 저장된 요소가 없으면 아무것도 렌더하지 않는다.
 */
export function HtmlComponentPicker({ onInsert }: { onInsert: (html: string) => void }) {
  const [items, setItems] = useState<HtmlComponentSummary[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listHtmlComponents().then(setItems).catch(() => {});
  }, []);

  async function pick(id: number) {
    if (!id) return;
    setBusy(true);
    try {
      const c = await getHtmlComponent(id);
      onInsert(c.html);
    } catch {
      /* 무시 */
    } finally {
      setBusy(false);
    }
  }

  if (items.length === 0) return null;

  return (
    <select
      className="input"
      style={{ maxWidth: 260, marginBottom: 8 }}
      value=""
      disabled={busy}
      onChange={(e) => {
        const v = Number(e.target.value);
        e.target.value = "";
        pick(v);
      }}
      title="저장된 HTML 요소를 이 블록에 삽입"
    >
      <option value="">+ 저장된 요소 불러오기…</option>
      {items.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
