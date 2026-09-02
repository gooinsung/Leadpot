import { useEffect, useMemo, useRef, useState } from "react";
import type { FormBlock, FormInput } from "../../api/client";
import { ConsentView } from "./ConsentView";
import { PhoneInput3 } from "../PhoneInput3";
import { descEmphasisClass, isMultiAnswerType, resolveStyle, resolveSubmitLabel } from "./formStyle";
import { CalcGateView } from "./CalcResultView";
import { findCalculator } from "../../lib/calculators/registry";

interface ChoiceOption {
  label?: string;
  desc?: string;
}

/** '기본 선택'(content.defaultIndex) → 선택된 인덱스 목록. 선택지 밖이면 없음 취급. */
function defaultSelection(block: FormBlock | undefined): number[] {
  const di = block?.content?.defaultIndex;
  if (typeof di !== "number") return [];
  const opts = (block?.content?.options as ChoiceOption[]) || [];
  return opts[di] == null ? [] : [di];
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
  const s = resolveStyle(form);
  /**
   * 계산기가 붙어 있으면 마지막 단계는 '결과 받기 위한 정보 입력' 화면이다.
   * 공개 폼(PublicFormView)과 **같은 컴포넌트·같은 문구**를 써야 한다 —
   * 미리보기와 실물이 다르면 마케터가 잘못된 화면을 보고 설계한다.
   */
  const calculator = useMemo(
    () => findCalculator(sorted.find((b) => b.blockType === "CALC")?.content?.calcKey as string | undefined),
    [sorted],
  );
  const submitLabel = resolveSubmitLabel(form, calculator?.gate.submitLabel);
  // 계산기 기본 문구 대신, '마지막 단계·연락처'의 상단 안내 문구/설명이 있으면 그걸로 덮어쓴다
  // (공개 렌더 PublicFormView와 동일한 규칙 — 미리보기가 실물과 달라지면 안 된다).
  const contactMessage = form.typeConfig?.contactMessage as string | undefined;
  const contactDescription = form.typeConfig?.contactDescription as string | undefined;
  const gate = calculator
    ? {
        ...calculator.gate,
        title: contactMessage?.trim() ? contactMessage : calculator.gate.title,
        highlight: contactDescription?.trim() ? contactDescription : calculator.gate.highlight,
      }
    : null;

  // 공개 렌더(PublicFormView)와 동일하게 단일 선택은 자동으로 다음 단계로 넘어간다 —
  // 미리보기가 실물과 다르면 마케터가 잘못된 흐름으로 오해한다.
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
  }, [step]);

  function toggleOption(stepIdx: number, optIdx: number, multi: boolean) {
    setSelections((prev) => {
      const cur = prev[stepIdx] ?? [];
      let next: number[];
      if (multi) next = cur.includes(optIdx) ? cur.filter((x) => x !== optIdx) : [...cur, optIdx];
      else next = [optIdx];
      return { ...prev, [stepIdx]: next };
    });
    if (!multi) {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = setTimeout(() => setStep((prev) => prev + 1), 100);
    }
  }

  if (totalSteps === 1 && choiceBlocks.length === 0 && contactBlocks.length === 0) {
    return <div className="fr-placeholder">단계를 추가하면 미리보기가 표시됩니다.</div>;
  }

  return (
    <div className="sfr">
      <div className="sfr-head">
        <span>
          {isContact ? (calculator ? "진단 결과" : "마지막 단계") : `질문 ${step + 1} / ${choiceBlocks.length}`}
        </span>
        <span>SSL 보안연결</span>
      </div>
      <div className="sfr-progress">
        <i style={{ width: `${((step + 1) / totalSteps) * 100}%`, background: s.accentColor }} />
      </div>

      {!isContact ? (
        <ChoiceStep
          block={choiceBlocks[step]}
          // 아직 안 만진 단계는 '기본 선택'을 그대로 보여준다(편집 중 값이 바뀌어도 즉시 반영).
          selected={selections[step] ?? defaultSelection(choiceBlocks[step])}
          accent={s.accentColor}
          onToggle={(optIdx, multi) => toggleOption(step, optIdx, multi)}
        />
      ) : (
        <div>
          {calculator && gate ? (
            <CalcGateView gate={gate} accentColor={s.accentColor} />
          ) : (
            <h3 className="t-h3" style={{ marginBottom: 12 }}>
              {(form.typeConfig?.contactMessage as string) || "연락처를 남겨주세요"}
            </h3>
          )}
          {!calculator && (form.typeConfig?.contactDescription as string) && (
            <p className={`dash-sub${descEmphasisClass(form.typeConfig?.contactDescriptionEmphasis)}`} style={{ marginTop: 0, marginBottom: 12 }}>
              {form.typeConfig?.contactDescription as string}
            </p>
          )}
          {contactBlocks.length === 0 && <p className="dash-sub">연락처 항목을 추가하세요.</p>}
          {contactBlocks.map((b, i) => (
            <div className="field" key={b.id ?? i}>
              <label>
                {b.label || "(제목 없음)"} {b.required && <span className="req">*</span>}
              </label>
              {(b.content?.description as string) && (
                <p className={`field-desc${descEmphasisClass(b.content?.descriptionEmphasis)}`}>{b.content?.description as string}</p>
              )}
              {b.fieldType === "tel" ? (
                <PhoneInput3 value="" onChange={() => {}} readOnly />
              ) : (
                <input className="input" placeholder={b.placeholder ?? ""} readOnly />
              )}
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
  const multi = isMultiAnswerType(answerType);
  const options = (block.content?.options as ChoiceOption[]) || [];
  const placeholder = (block.content?.placeholder as string) || "";

  return (
    <div>
      <h3 className="t-h3" style={{ marginBottom: 4 }}>
        {question} {block.content?.required === true && <span className="req">*</span>}
      </h3>
      {description && (
        <p className={`dash-sub${descEmphasisClass(block.content?.descriptionEmphasis)}`} style={{ marginTop: 0, marginBottom: 12 }}>
          {description}
        </p>
      )}
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
      ) : answerType === "list_single" || answerType === "list_multi" ? (
        <div className="sfr-list">
          {options.map((o, i) => (
            <label key={i} className={`sfr-list-item ${selected.includes(i) ? "sel" : ""}`}>
              <input
                type={multi ? "checkbox" : "radio"}
                name="sfr-list-preview"
                checked={selected.includes(i)}
                onChange={() => onToggle(i, multi)}
                style={{ accentColor: accent }}
              />
              <span className="sfr-list-t">{o.label || `선택지 ${i + 1}`}</span>
            </label>
          ))}
          {options.length === 0 && <p className="dash-sub">선택지를 추가하세요.</p>}
        </div>
      ) : answerType === "select" ? (
        <div className="sfr-field">
          <select className="input" value={options[selected[0]]?.label ?? ""} onChange={() => {}}>
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
