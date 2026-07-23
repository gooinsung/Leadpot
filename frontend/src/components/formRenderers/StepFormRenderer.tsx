import { useMemo, useState } from "react";
import type { FormBlock, FormInput } from "../../api/client";
import { ConsentView } from "./ConsentView";
import { resolveStyle } from "./formStyle";

interface ChoiceOption {
  label?: string;
  desc?: string;
}

/** STEP 유형 렌더러 — 진행바 + 단계별 카드 선택 + 다음/이전 + 마지막 연락처 단계(인라인 미리보기). */
export function StepFormRenderer({ form }: { form: FormInput }) {
  const sorted = useMemo(() => [...form.blocks].sort((a, b) => a.sortOrder - b.sortOrder), [form.blocks]);
  const choiceBlocks = useMemo(() => sorted.filter((b) => b.blockType === "CHOICE"), [sorted]);
  const contactBlocks = useMemo(() => sorted.filter((b) => b.blockType === "FIELD"), [sorted]);

  const totalSteps = choiceBlocks.length + 1; // 질문 단계들 + 마지막 연락처 단계
  const [step, setStep] = useState(0);
  const [selections, setSelections] = useState<Record<number, number[]>>({});

  const isContact = step >= choiceBlocks.length;
  const submitLabel = (form.submitButtonConfig?.label as string) || "제출하기";
  const s = resolveStyle(form);

  function toggleOption(stepIdx: number, optIdx: number, multi: boolean) {
    setSelections((prev) => {
      const cur = prev[stepIdx] ?? [];
      let next: number[];
      if (multi) next = cur.includes(optIdx) ? cur.filter((x) => x !== optIdx) : [...cur, optIdx];
      else next = [optIdx];
      return { ...prev, [stepIdx]: next };
    });
  }

  if (totalSteps === 1 && choiceBlocks.length === 0 && contactBlocks.length === 0) {
    return <div className="fr-placeholder">단계를 추가하면 미리보기가 표시됩니다.</div>;
  }

  return (
    <div className="sfr">
      <div className="sfr-head">
        <span>{isContact ? "마지막 단계" : `질문 ${step + 1} / ${choiceBlocks.length}`}</span>
        <span>SSL 보안연결</span>
      </div>
      <div className="sfr-progress">
        <i style={{ width: `${((step + 1) / totalSteps) * 100}%`, background: s.accentColor }} />
      </div>

      {!isContact ? (
        <ChoiceStep
          block={choiceBlocks[step]}
          selected={selections[step] ?? []}
          accent={s.accentColor}
          onToggle={(optIdx, multi) => toggleOption(step, optIdx, multi)}
        />
      ) : (
        <div>
          <h3 className="t-h3" style={{ marginBottom: 12 }}>
            {(form.typeConfig?.contactMessage as string) || "연락처를 남겨주세요"}
          </h3>
          {contactBlocks.length === 0 && <p className="dash-sub">연락처 항목을 추가하세요.</p>}
          {contactBlocks.map((b, i) => (
            <div className="field" key={b.id ?? i}>
              <label>
                {b.label || "(제목 없음)"} {b.required && <span className="req">*</span>}
              </label>
              <input className="input" placeholder={b.placeholder ?? ""} readOnly />
            </div>
          ))}
          <ConsentView config={form.consentConfig} accent={s.accentColor} />
        </div>
      )}

      <div className="sfr-nav">
        {step > 0 && (
          <button className="btn btn-ghost" type="button" onClick={() => setStep((s) => s - 1)}>
            이전
          </button>
        )}
        {isContact ? (
          <button className="btn" type="button" style={{ flex: 1, background: s.buttonColor, color: s.buttonText }}>
            {submitLabel}
          </button>
        ) : (
          <button
            className="btn"
            type="button"
            style={{ flex: 1, background: s.accentColor, color: s.accentText }}
            onClick={() => setStep((prev) => prev + 1)}
          >
            다음
          </button>
        )}
      </div>
    </div>
  );
}

function ChoiceStep({
  block,
  selected,
  accent,
  onToggle,
}: {
  block: FormBlock;
  selected: number[];
  accent: string;
  onToggle: (optIdx: number, multi: boolean) => void;
}) {
  const question = (block.content?.question as string) || "(질문 없음)";
  const description = block.content?.description as string | undefined;
  const answerType = (block.content?.answerType as string) || (block.content?.selectType as string) || "single";
  const multi = answerType === "multi";
  const options = (block.content?.options as ChoiceOption[]) || [];
  const placeholder = (block.content?.placeholder as string) || "";

  return (
    <div>
      <h3 className="t-h3" style={{ marginBottom: 4 }}>{question}</h3>
      {description && <p className="dash-sub" style={{ marginTop: 0, marginBottom: 12 }}>{description}</p>}
      {answerType === "single" || answerType === "multi" ? (
        <div className="sfr-options">
          {options.map((o, i) => (
            <button
              key={i}
              type="button"
              className={`sfr-opt ${selected.includes(i) ? "sel" : ""}`}
              style={selected.includes(i) ? { borderColor: accent, background: `${accent}1f` } : undefined}
              onClick={() => onToggle(i, multi)}
            >
              <span className="sfr-opt-t">{o.label || `선택지 ${i + 1}`}</span>
              {o.desc && <span className="sfr-opt-d">{o.desc}</span>}
            </button>
          ))}
          {options.length === 0 && <p className="dash-sub">선택지를 추가하세요.</p>}
        </div>
      ) : answerType === "select" ? (
        <div className="sfr-field">
          <select className="input" defaultValue="">
            <option value="" disabled>{placeholder || "선택하세요"}</option>
            {options.map((o, i) => <option key={i} value={o.label}>{o.label || `선택지 ${i + 1}`}</option>)}
          </select>
        </div>
      ) : answerType === "textarea" ? (
        <div className="sfr-field">
          <textarea className="input" rows={4} placeholder={placeholder} readOnly />
        </div>
      ) : (
        <div className="sfr-field">
          <input className="input" type={answerType === "tel" ? "tel" : answerType === "email" ? "email" : answerType === "number" ? "number" : answerType === "date" ? "date" : "text"} placeholder={placeholder} readOnly />
        </div>
      )}
    </div>
  );
}
