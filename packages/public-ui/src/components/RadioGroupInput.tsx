"use client";
import { joinGroupPicks, parseGroupPicks } from "../lib/fieldTypes";

/**
 * '라디오 묶음' 입력 — 질문(rows)마다 같은 선택지(choices)를 라디오로 하나씩 고른다.
 * 값은 질문 순서대로 고른 인덱스를 쉼표로 이은 문자열(lib/fieldTypes 의 parseGroupPicks/joinGroupPicks).
 *
 * 공개 폼은 대부분 모바일 → 선택지는 한 줄에 나란히 두되 좁으면 줄바꿈되고, 선택지 하나하나가
 * 44px 높이의 탭 타깃이 되게 라벨 전체를 누를 수 있게 한다(CLAUDE.md 모바일 퍼스트).
 */
export function RadioGroupInput({
  id,
  name,
  rows,
  choices,
  value,
  onChange,
  accent,
  readOnly,
}: {
  id?: string;
  /** 라디오 name 접두사 — 같은 화면의 다른 항목과 겹치지 않게. */
  name: string;
  rows: string[];
  choices: string[];
  value: string;
  onChange: (v: string) => void;
  accent?: string;
  /** 편집기 미리보기 — 눌러도 바뀌지 않는다. */
  readOnly?: boolean;
}) {
  const picks = parseGroupPicks(value, rows.length);
  function pick(ri: number, ci: number) {
    if (readOnly) return;
    onChange(joinGroupPicks(picks.map((p, i) => (i === ri ? ci : p))));
  }
  if (rows.length === 0) return <p className="dash-sub">질문을 추가하세요.</p>;
  return (
    <div className="rg" id={id}>
      {rows.map((row, ri) => (
        <div className="rg-row" key={ri} role="radiogroup" aria-label={row || `질문 ${ri + 1}`}>
          <p className="rg-q">{row || `질문 ${ri + 1}`}</p>
          <div className="rg-opts">
            {choices.map((c, ci) => (
              <label key={ci} className={`rg-opt${picks[ri] === ci ? " sel" : ""}`}>
                <input
                  type="radio"
                  name={`${name}-${ri}`}
                  checked={picks[ri] === ci}
                  onChange={() => pick(ri, ci)}
                  style={{ accentColor: accent }}
                />
                <span>{c || `선택지 ${ci + 1}`}</span>
              </label>
            ))}
            {choices.length === 0 && <p className="dash-sub">선택지를 추가하세요.</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
