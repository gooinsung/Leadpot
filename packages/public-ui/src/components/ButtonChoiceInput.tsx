import type { CSSProperties } from "react";
import { buttonChoiceRows, type ButtonChoiceLayout } from "../lib/fieldTypes";
import { textOn } from "./formRenderers/formStyle";

/**
 * '버튼 선택' 입력 — 선택지를 큰 버튼(타일)으로 펼친다. 공개 폼(LiveField)과 편집기 미리보기(FieldView)가
 * 같은 컴포넌트를 써서 모양이 갈라지지 않게 한다.
 *
 * 줄 나누기는 {@link buttonChoiceRows}(가로: 3개 이하 한 줄 · 홀수 3/2/2… · 짝수 2/2…, 세로: 한 줄에 하나).
 * 고른 버튼은 리드폼 포인트 색(accent)으로 채운다. 단일이면 다른 걸 누르면 바뀌고, 다중이면 다시 눌러 해제한다.
 */
export function ButtonChoiceInput({
  id,
  choices,
  picked,
  multiple,
  layout,
  accent,
  onPick,
}: {
  id?: string;
  choices: string[];
  picked: number[];
  multiple: boolean;
  layout: ButtonChoiceLayout;
  accent?: string;
  /** 선택지 인덱스를 눌렀을 때. 없으면(미리보기) 눌러도 아무 일 없다. */
  onPick?: (index: number) => void;
}) {
  const rows = buttonChoiceRows(choices.length, layout);
  const color = accent || "#3a43c0";
  const selStyle: CSSProperties = { background: color, borderColor: color, color: textOn(color) };
  let start = 0;
  return (
    <div className="fr-btnchoice" id={id} role={multiple ? "group" : "radiogroup"}>
      {rows.map((n, ri) => {
        const from = start;
        start += n;
        return (
          <div key={ri} className="fr-btnchoice-row" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {choices.slice(from, from + n).map((c, k) => {
              const i = from + k;
              const sel = picked.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  className={`fr-btnchoice-opt${sel ? " sel" : ""}`}
                  role={multiple ? "checkbox" : "radio"}
                  aria-checked={sel}
                  style={sel ? selStyle : undefined}
                  onClick={() => onPick?.(i)}
                >
                  {c || `선택지 ${i + 1}`}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
