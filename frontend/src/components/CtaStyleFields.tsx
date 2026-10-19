import { CTA_BUTTON_EFFECTS, CTA_RADII, CTA_SIZES, CTA_TEXT_EFFECTS, resolveCtaStyle, type LandingBlock } from "@leadpot/public-ui";

/**
 * 랜딩 FORM 블록(노출 방식 = 버튼 → 오버레이/풀스크린)의 CTA 버튼 꾸밈 —
 * 글자 효과(깜빡임·반짝임 등)·버튼 움직임·크기·모서리·굵게·그림자·색.
 * 값은 블록에 그대로 저장하고 공개 렌더는 `LandingCtaButton`(public-ui)이 해석한다.
 */
export function CtaStyleFields({ block, onPatch }: { block: LandingBlock; onPatch: (p: Record<string, unknown>) => void }) {
  const st = resolveCtaStyle(block);
  return (
    <div className="cta-style-fields">
      <span className="mini-label">버튼 꾸미기</span>
      <div className="block-row">
        <div className="field" style={{ flex: 1 }}>
          <label>글자 효과</label>
          <select className="input" value={st.textFx} onChange={(e) => onPatch({ btnTextFx: e.target.value })}>
            {CTA_TEXT_EFFECTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>버튼 움직임</label>
          <select className="input" value={st.buttonFx} onChange={(e) => onPatch({ btnFx: e.target.value })}>
            {CTA_BUTTON_EFFECTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>
      <div className="block-row">
        <div className="field" style={{ flex: 1 }}>
          <label>버튼 크기</label>
          <select className="input" value={st.size} onChange={(e) => onPatch({ btnSize: e.target.value })}>
            {CTA_SIZES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>모서리</label>
          <select className="input" value={st.radius} onChange={(e) => onPatch({ btnRadius: e.target.value })}>
            {CTA_RADII.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>
      <div className="block-row">
        <label className="fr-check">
          <input type="checkbox" checked={st.bold} onChange={(e) => onPatch({ btnBold: e.target.checked || undefined })} /> 글자 굵게
        </label>
        <label className="fr-check">
          <input type="checkbox" checked={st.shadow} onChange={(e) => onPatch({ btnShadow: e.target.checked || undefined })} /> 그림자
        </label>
      </div>
      <OptionalHexField label="버튼 색" value={(block.btnColor as string) ?? ""} onChange={(v) => onPatch({ btnColor: v || undefined })} />
      <OptionalHexField label="글자 색" value={(block.btnTextColor as string) ?? ""} onChange={(v) => onPatch({ btnTextColor: v || undefined })} />
    </div>
  );
}

/** 빈 값 = 연결된 리드폼의 버튼 색을 따라감. */
function OptionalHexField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <div className="color-field">
      <label className="mini-label">{label}</label>
      <div className="color-row">
        <input type="color" className="color-input" value={valid ? value : "#ffffff"} onChange={(e) => onChange(e.target.value)} />
        <input
          className="input hex-input"
          value={value}
          placeholder="#rrggbb (비우면 리드폼 버튼 색)"
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
        {value && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange("")}>리드폼 색으로</button>}
      </div>
    </div>
  );
}
