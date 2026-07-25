import { DYNAMIC_SNIPPETS } from "../lib/dynamicSnippets";

/**
 * 랜딩 HTML 블록에 M8 동적 요소 스니펫을 삽입하는 셀렉트.
 * 선택 시 해당 스니펫 HTML 을 onInsert 로 전달(호출부에서 기존 값에 이어붙임).
 */
export function DynamicSnippetPicker({ onInsert }: { onInsert: (html: string) => void }) {
  return (
    <select
      className="input"
      style={{ maxWidth: 260, marginBottom: 8 }}
      value=""
      onChange={(e) => {
        const s = DYNAMIC_SNIPPETS.find((x) => x.key === e.target.value);
        e.target.value = "";
        if (s) onInsert(s.html);
      }}
      title="동적 요소 삽입(실시간 신청수·토스트·남은자리·플로팅)"
    >
      <option value="">+ 동적 요소 삽입…</option>
      {DYNAMIC_SNIPPETS.map((s) => (
        <option key={s.key} value={s.key}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
