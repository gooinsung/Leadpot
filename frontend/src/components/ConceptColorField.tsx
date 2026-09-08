/**
 * 배경 컬러 선택 — 프리셋(화이트/블랙/블루) + 커스텀 색상 피커.
 * 랜딩페이지 전체 배경 컬러(`LandingPage.bgColor`, V43)를 편집할 때 쓴다(빈 값 = 화이트/기본,
 * 기존 모습 그대로). 값 형태만 다루는 범용 컴포넌트라 다른 색상 설정에도 재사용 가능하다.
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
