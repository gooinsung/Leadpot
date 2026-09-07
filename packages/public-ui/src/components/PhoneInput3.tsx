import { useRef, useState } from "react";

/**
 * 연락처 3칸 입력 — [010] - [XXXX] - [XXXX].
 *
 * <ul>
 *   <li>앞자리는 <b>010 이 기본</b>으로 채워져 있다(011·016 등으로 고칠 수 있게 입력형으로 둔다).</li>
 *   <li>가운데 칸에 4자리를 채우면 <b>마지막 칸으로 자동 이동</b>한다.</li>
 *   <li>상위로는 <code>010-1234-5678</code> 한 문자열로 올려보낸다. 뒷자리가 모두 비면 빈 문자열을
 *       보내 <b>선택 항목이 '입력됨'으로 오해되지 않게</b> 한다(필수 검증도 정상 동작).</li>
 * </ul>
 *
 * <p>저장 형식에 하이픈이 들어가지만 문자 발송은 숫자만 남기고 보내므로(PhoneNumbers.normalize)
 * 발송에는 영향이 없다.
 *
 * <p>⚠️ <b>'010 기본 채움'은 한시적 요구다(2026-08-09 사용자 요청, 나중에 빠질 수 있음).</b>
 * 되돌릴 때는 이 컴포넌트를 쓰는 곳(PublicFormView 의 tel 분기 등)을 일반 input 으로
 * 되돌리면 된다 — 다른 로직은 이 파일에만 있다.
 */
const DEFAULT_PREFIX = "010";

/** "010-1234-5678" / "01012345678" / "" → [앞, 가운데, 뒤] */
function splitPhone(v: string): [string, string, string] {
  const digits = (v ?? "").replace(/\D/g, "");
  if (!digits) return [DEFAULT_PREFIX, "", ""];
  const head = digits.slice(0, 3);
  const rest = digits.slice(3);
  if (rest.length <= 4) return [head, rest, ""];
  return [head, rest.slice(0, rest.length - 4), rest.slice(-4)];
}

/** 뒷자리가 모두 비면 빈 값 — 앞자리만 남은 "010--" 이 입력값으로 취급되지 않게 한다. */
function joinPhone(p1: string, p2: string, p3: string): string {
  if (!p2 && !p3) return "";
  return `${p1}-${p2}-${p3}`;
}

const onlyDigits = (s: string) => s.replace(/\D/g, "");

export function PhoneInput3({
  id,
  value,
  onChange,
  required,
  readOnly,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  readOnly?: boolean;
}) {
  // 세 칸을 각각 들고 있는다 — 합친 문자열만 보고 매번 되쪼개면
  // 뒷칸부터 채우는 등의 경우에 값이 앞칸으로 밀린다.
  const [parts, setParts] = useState<[string, string, string]>(() => splitPhone(value));
  const midRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef<HTMLInputElement>(null);

  function update(idx: 0 | 1 | 2, raw: string) {
    const next: [string, string, string] = [...parts] as [string, string, string];
    next[idx] = onlyDigits(raw).slice(0, idx === 0 ? 3 : 4);
    setParts(next);
    onChange(joinPhone(next[0], next[1], next[2]));
    // 가운데 4자리를 채우면 마지막 칸으로 이동
    if (idx === 1 && next[1].length === 4) lastRef.current?.focus();
  }

  return (
    <div className="phone3-row">
      <input
        id={id}
        className="input phone3-box"
        type="tel"
        inputMode="numeric"
        maxLength={3}
        value={parts[0]}
        readOnly={readOnly}
        required={required}
        aria-label="연락처 앞자리"
        onChange={(e) => update(0, e.target.value)}
      />
      <span className="phone3-sep">-</span>
      <input
        ref={midRef}
        className="input phone3-box"
        type="tel"
        inputMode="numeric"
        maxLength={4}
        value={parts[1]}
        readOnly={readOnly}
        aria-label="연락처 가운데 자리"
        onChange={(e) => update(1, e.target.value)}
      />
      <span className="phone3-sep">-</span>
      <input
        ref={lastRef}
        className="input phone3-box"
        type="tel"
        inputMode="numeric"
        maxLength={4}
        value={parts[2]}
        readOnly={readOnly}
        aria-label="연락처 뒷자리"
        onChange={(e) => update(2, e.target.value)}
      />
    </div>
  );
}
