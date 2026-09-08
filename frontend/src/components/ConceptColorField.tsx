/**
 * 리드폼 카드 배경 컨셉 선택 — 프리셋(화이트/블랙/블루) + 커스텀 색상 피커.
 * `styleConfig.bgColor` 에 저장된다(빈 값 = 화이트/기본, 기존 모습 그대로).
 * 랜딩 편집기(FORM 블록)·리드폼 편집기 양쪽에서 같은 값을 편집한다(사용자 결정, 2026-09-08).
 */
const CONCEPT_PRESETS: { label: string; value: string }[] = [
  { label: "화이트(기본)", value: "" },
  { label: "블랙", value: "#14172a" },
  { label: "블루", value: "#1b2a63" },
];

export function ConceptColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="color-field">
      <label className="mini-label">{label}</label>
      <div className="color-row">
        <div className="swatches">
          {CONCEPT_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`swatch-btn ${value === p.value ? "on" : ""}`}
              style={p.value ? { background: p.value } : { background: "#fff", border: "1px dashed var(--border)" }}
              onClick={() => onChange(p.value)}
              title={p.label}
              aria-label={p.label}
            />
          ))}
        </div>
        <input type="color" className="color-input" value={value || "#ffffff"} onChange={(e) => onChange(e.target.value)} />
        <input
          className="input hex-input"
          value={value}
          placeholder="#ffffff (기본)"
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
