"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { HtmlBlock } from "./HtmlBlock";
import {
  ApiError,
  submitLead,
  type ConsentItem,
  type FormBlock,
  type FormDetail,
  type LeadAnswer,
  type LeadConsent,
} from "../api/client";
import { descEmphasisClass, resolveStyle, resolveSubmitLabel } from "./formRenderers/formStyle";
import {
  choiceAsField,
  fieldAnswer,
  fieldBlockError,
  fieldDefaultValue,
  isCardAnswerType,
  isListField,
  parsePicked,
  stepAnswerType,
} from "../lib/fieldTypes";
import { PhoneInput3 } from "./PhoneInput3";
import { ConsentItemRow } from "./formRenderers/ConsentItemRow";
import { parseUtm } from "../lib/utm";
import { CompletionView } from "./formRenderers/CompletionView";
import { firePixelLead } from "../lib/pixels";
import { CalcFollowUp, CalcGateView, CalcLoadingView, CalcResultView } from "./formRenderers/CalcResultView";
import { findCalculator } from "../lib/calculators/registry";
import type { CalcView, CalculatorDef } from "../lib/calculators/types";

/**
 * 계산기 입력값 모으기 — 질문(CHOICE) 블록 중 `content.calcInput` 이 붙은 것들의 답을
 * `{계산기입력키: 값}` 으로 만든다.
 *
 * 인덱스가 아니라 블록에 박힌 키로 찾으므로 **마케터가 단계 순서를 바꿔도 안 깨진다**.
 * 카드 선택지는 `value`(계산에 쓰는 숫자)를 우선하고 없으면 라벨을 쓴다.
 */
function collectCalcInputs(
  choiceBlocks: FormBlock[],
  values: Record<string, string>,
  choices: Record<number, number[]>,
): Record<string, string> {
  const raw: Record<string, string> = {};
  choiceBlocks.forEach((b, i) => {
    const key = b.content?.calcInput as string | undefined;
    if (!key) return;
    const answerType = stepAnswerType(b);
    if (isCardAnswerType(answerType) || isListField(answerType)) {
      const opts = (b.content?.options as { label?: string; value?: string }[]) ?? [];
      const idx = isCardAnswerType(answerType) ? choices[i] ?? [] : parsePicked(values[`s${i}`] ?? "");
      const picked = idx.map((oi) => opts[oi]?.value ?? opts[oi]?.label ?? "").filter(Boolean);
      // 미선택은 키를 넣지 않는다 — 계산기가 '미입력'과 '0'을 구분해 전제 경고를 붙인다.
      if (picked.length) raw[key] = picked.join(",");
    } else {
      const v = (values[`s${i}`] ?? "").trim();
      if (v) raw[key] = v;
    }
  });
  return raw;
}

/**
 * 실제 제출 가능한 공개 리드폼 렌더러(비로그인).
 * 단독 공개 리드폼(/f/{id})과 랜딩(/p/{slug}) 인라인·오버레이에서 공용으로 사용.
 */
export function PublicFormView({
  form,
  landingPageId,
  onSubmitted,
  trackingConfig,
}: {
  form: FormDetail;
  landingPageId?: number | null;
  onSubmitted?: () => void;
  trackingConfig?: Record<string, unknown> | null; // 리드 제출 시 전환(Lead) 발사할 픽셀
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<number, number[]>>({});
  const [agreed, setAgreed] = useState<Record<number, boolean>>({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  /** 계산기: 접수 직후 "AI가 계산 중" 을 3초 보여준 다음 결과를 공개한다. */
  const [revealing, setRevealing] = useState(false);

  const consentItems = useMemo(() => (form.consentConfig?.items as ConsentItem[]) ?? [], [form]);

  useEffect(() => {
    const init: Record<number, boolean> = {};
    consentItems.forEach((it, i) => {
      if (it.defaultChecked) init[i] = true;
    });
    setAgreed(init);
  }, [consentItems]);

  const style = resolveStyle(form);
  const sorted = useMemo(() => [...form.blocks].sort((a, b) => a.sortOrder - b.sortOrder), [form]);

  // ---- 계산기(CALC) ----
  // 계산은 여기서(브라우저에서) 끝난다 — 서버 왕복이 없어 결과가 즉시 뜨고 임베드에서도 그대로 돈다.
  const calculator = useMemo(() => {
    const block = sorted.find((b) => b.blockType === "CALC");
    return findCalculator(block?.content?.calcKey as string | undefined);
  }, [sorted]);
  const choiceBlocks = useMemo(() => sorted.filter((b) => b.blockType === "CHOICE"), [sorted]);
  const calcView: CalcView | null = useMemo(
    () => (calculator ? calculator.run(collectCalcInputs(choiceBlocks, values, choices)) : null),
    [calculator, choiceBlocks, values, choices],
  );

  /**
   * '기본 선택'(defaultIndex) 초기값 주입 — 선택박스·단일/다중 선택에 미리 골라둔 값을 채운다.
   * 이미 사용자가 만진 값(prev)이 항상 이긴다 → 지운 선택이 되살아나지 않는다.
   * 선택지를 지워 인덱스가 어긋난 경우는 무시한다(존재할 때만 적용).
   */
  useEffect(() => {
    const initValues: Record<string, string> = {};
    const initChoices: Record<number, number[]> = {};
    if (form.formType === "BASIC") {
      sorted.forEach((b, i) => {
        if (b.blockType !== "FIELD") return;
        const v = fieldDefaultValue(b);
        if (v != null) initValues[`f${i}`] = v;
      });
    } else {
      sorted.filter((b) => b.blockType === "CHOICE").forEach((b, i) => {
        if (isCardAnswerType(stepAnswerType(b))) {
          const di = b.content?.defaultIndex;
          const opts = (b.content?.options as { label?: string }[]) ?? [];
          if (typeof di === "number" && opts[di] != null) initChoices[i] = [di];
          return;
        }
        // 카드형이 아니면 기본형 입력 항목과 같은 규칙
        const v = fieldDefaultValue(choiceAsField(b));
        if (v != null) initValues[`s${i}`] = v;
      });
    }
    if (Object.keys(initValues).length) setValues((prev) => ({ ...initValues, ...prev }));
    if (Object.keys(initChoices).length) setChoices((prev) => ({ ...initChoices, ...prev }));
  }, [form.formType, sorted]);
  const submitLabel = resolveSubmitLabel(form, calculator?.gate.submitLabel);

  function setVal(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function buildAnswers(): LeadAnswer[] {
    const out: LeadAnswer[] = [];
    if (form.formType === "BASIC") {
      sorted.forEach((b, i) => {
        if (b.blockType !== "FIELD") return;
        out.push({ label: b.label || `항목 ${i + 1}`, fieldType: b.fieldType ?? "text", value: fieldAnswer(b, values[`f${i}`]) });
      });
    } else {
      const choiceBlocks = sorted.filter((b) => b.blockType === "CHOICE");
      choiceBlocks.forEach((b, i) => {
        const answerType = stepAnswerType(b);
        let value: string;
        if (isCardAnswerType(answerType)) {
          const opts = (b.content?.options as { label?: string }[]) ?? [];
          value = (choices[i] ?? []).map((oi) => opts[oi]?.label ?? `선택지 ${oi + 1}`).join(", ");
        } else {
          value = fieldAnswer(choiceAsField(b), values[`s${i}`]);
        }
        out.push({ label: (b.content?.question as string) || `질문 ${i + 1}`, fieldType: answerType, value });
      });
      sorted.filter((b) => b.blockType === "FIELD").forEach((b, i) => {
        out.push({ label: b.label || `항목 ${i + 1}`, fieldType: b.fieldType ?? "text", value: fieldAnswer(b, values[`c${i}`]) });
      });
      // 계산 결과를 답변으로 함께 저장 — 이 label 이 구글시트 열 이름이자 문자 변수({{예상 탕감액}})가 된다.
      if (calculator && calcView) out.push(...calculator.toAnswers(calcView));
    }
    return out;
  }

  function buildConsents(): LeadConsent[] {
    return consentItems.map((it, i) => ({ title: it.title, required: it.required, agreed: Boolean(agreed[i]) }));
  }

  /** 제출 전 전체 검증(필수·형식·동의). 에러 메시지 또는 null. */
  function validateAll(): string | null {
    if (consentItems.some((it, i) => it.required && !agreed[i])) return "필수 동의 항목에 동의해주세요.";
    if (form.formType === "BASIC") {
      for (let i = 0; i < sorted.length; i++) {
        const b = sorted[i];
        if (b.blockType !== "FIELD") continue;
        const e = fieldBlockError(b, values[`f${i}`]);
        if (e) return e;
      }
    } else {
      const choiceBlocks = sorted.filter((b) => b.blockType === "CHOICE");
      for (let i = 0; i < choiceBlocks.length; i++) {
        const b = choiceBlocks[i];
        if (isCardAnswerType(stepAnswerType(b))) {
          const label = (b.content?.question as string) || "질문";
          if (b.content?.required === true && (choices[i] ?? []).length === 0) return `'${label}' 항목을 선택해주세요.`;
        } else {
          const e = fieldBlockError(choiceAsField(b), values[`s${i}`]);
          if (e) return e;
        }
      }
      const contactBlocks = sorted.filter((b) => b.blockType === "FIELD");
      for (let i = 0; i < contactBlocks.length; i++) {
        const b = contactBlocks[i];
        const e = fieldBlockError(b, values[`c${i}`]);
        if (e) return e;
      }
    }
    return null;
  }

  async function onSubmit(e?: FormEvent) {
    e?.preventDefault();
    setSubmitError("");
    const err = validateAll();
    if (err) {
      setSubmitError(err);
      return;
    }
    setSubmitting(true);
    try {
      await submitLead({ formId: form.id, landingPageId: landingPageId ?? null, answers: buildAnswers(), consents: buildConsents(), utm: parseUtm() });
      firePixelLead(trackingConfig); // 전환(Lead) 픽셀 발사 — 각 플랫폼이 클릭ID로 자체 귀속
      const success = form.successConfig;
      if (success?.mode === "redirect" && success?.redirectUrl) {
        window.location.href = success.redirectUrl as string;
        return;
      }
      // 계산기가 붙은 폼은 결과 공개 전 3초 로딩을 거친다(리다이렉트 설정이면 여기까지 오지 않는다).
      if (calculator) {
        setRevealing(true);
        setTimeout(() => setRevealing(false), 3000);
      }
      setSubmitted(true);
      onSubmitted?.();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  // 계산기: 접수가 끝난 **뒤** 결과를 보여준다(결과를 먼저 보여주면 그것만 보고 나간다).
  // 계산은 이미 끝나 있지만 3초 로딩을 거친다 — 즉시 뜨면 4개 답변으로 뽑은 숫자의 무게가 안 실린다.
  if (submitted && calculator && calcView) {
    return revealing ? (
      <CalcLoadingView accentColor={style.accentColor} />
    ) : (
      <div className="calc-result-screen">
        <CalcResultView view={calcView} disclaimer={calculator.disclaimer} accentColor={style.accentColor} />
        <CalcFollowUp text={calculator.followUp} />
      </div>
    );
  }
  if (submitted) return <CompletionView config={form.successConfig} accent={style.accentColor} />;

  return (
    <>
      {form.requirePhoneVerification && <div className="phone-verify-note">🔒 제출 시 휴대폰 본인인증 필요</div>}
      {form.formType === "BASIC" ? (
        <form onSubmit={onSubmit}>
          {sorted.map((b, i) => (
            <LiveBlock
              key={i}
              block={b}
              idx={i}
              value={values[`f${i}`] ?? ""}
              onChange={(v) => setVal(`f${i}`, v)}
              accent={style.accentColor}
            />
          ))}
          <ConsentInputs items={consentItems} agreed={agreed} setAgreed={setAgreed} accent={style.accentColor} />
          {submitError && <p className="auth-error">{submitError}</p>}
          <button className="btn" type="submit" disabled={submitting}
            style={{ width: "100%", marginTop: 8, background: style.buttonColor, color: style.buttonText }}>
            {submitting ? "제출 중…" : submitLabel}
          </button>
        </form>
      ) : (
        <StepFlow
          sorted={sorted}
          contactMessage={(form.typeConfig?.contactMessage as string) || ""}
          contactDescription={(form.typeConfig?.contactDescription as string) || ""}
          consentItems={consentItems}
          values={values} setVal={setVal}
          choices={choices} setChoices={setChoices}
          agreed={agreed} setAgreed={setAgreed}
          step={step} setStep={setStep}
          style={style} submitLabel={submitLabel}
          submitting={submitting} submitError={submitError}
          onSubmit={onSubmit}
          calcView={calcView}
          calcDisclaimer={calculator?.disclaimer ?? ""}
          calcGate={calculator?.gate ?? null}
        />
      )}
    </>
  );
}

type LiveFieldProps = {
  block: FormBlock;
  idx: number;
  value: string;
  onChange: (v: string) => void;
  /** 라디오·체크박스의 선택 강조색. */
  accent?: string;
  /** 항목명·설명을 그리지 않는다 — 스텝형 질문처럼 제목을 바깥에서 따로 그릴 때. */
  bare?: boolean;
};

function LiveBlock(props: LiveFieldProps) {
  const { block } = props;
  switch (block.blockType) {
    case "IMAGE": {
      const url = block.content?.url as string | undefined;
      return url ? <img className="fr-img" src={url} alt={(block.content?.alt as string) || ""} /> : null;
    }
    case "HTML":
      return <HtmlBlock className="fr-html" html={(block.content?.html as string) || ""} />;
    case "TEXT":
      return <p className="fr-text">{(block.content?.text as string) || ""}</p>;
    case "DIVIDER":
      return <hr className="fr-divider" />;
    case "FIELD":
      return <LiveField {...props} />;
    default:
      return null;
  }
}

/**
 * 입력 항목 하나. 기본형 항목·스텝형 질문(choiceAsField 로 변환)·스텝형 연락처 항목이 모두 이걸로 그려진다 —
 * 입력 유형(lib/fieldTypes)을 늘리면 여기 분기 하나로 두 폼에 함께 반영된다.
 */
function LiveField({ block, idx, value, onChange, accent, bare }: LiveFieldProps) {
  const type = block.fieldType || "text";
  const picked = isListField(type) ? parsePicked(value) : [];
  /** 라디오는 하나만, 체크박스는 여러 개 — 이미 고른 체크박스를 누르면 해제한다. */
  function pick(ci: number) {
    const next = type === "checkbox" ? (picked.includes(ci) ? picked.filter((x) => x !== ci) : [...picked, ci]) : [ci];
    onChange(next.join(","));
  }
  const choices = (block.options?.choices as string[]) ?? [];
  const inputType = type === "email" ? "email" : type === "tel" ? "tel" : type === "number" ? "number" : type === "date" ? "date" : "text";
  return (
    <div className={bare ? "sfr-field" : "field"}>
      {!bare && (
        <label htmlFor={`fld-${idx}`}>
          {block.label || "(제목 없음)"} {block.required && <span className="req">*</span>}
        </label>
      )}
      {!bare && (block.content?.description as string) && (
        <p className={`field-desc${descEmphasisClass(block.content?.descriptionEmphasis)}`}>{block.content?.description as string}</p>
      )}
      {type === "textarea" ? (
        <textarea id={`fld-${idx}`} className="input" rows={3} placeholder={block.placeholder ?? ""} required={block.required} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : type === "select" ? (
        <select id={`fld-${idx}`} className="input" required={block.required} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{block.placeholder || "선택하세요"}</option>
          {choices.map((c, i) => <option key={i} value={c}>{c || `선택지 ${i + 1}`}</option>)}
        </select>
      ) : isListField(type) ? (
        <div className="sfr-list" id={`fld-${idx}`} role={type === "radio" ? "radiogroup" : "group"}>
          {choices.map((c, i) => (
            <label key={i} className={`sfr-list-item ${picked.includes(i) ? "sel" : ""}`}>
              <input
                type={type}
                name={`fld-${idx}`}
                checked={picked.includes(i)}
                onChange={() => pick(i)}
                style={{ accentColor: accent }}
              />
              <span className="sfr-list-t">{c || `선택지 ${i + 1}`}</span>
            </label>
          ))}
        </div>
      ) : type === "tel" ? (
        <PhoneInput3 id={`fld-${idx}`} value={value} onChange={onChange} required={block.required} />
      ) : (
        <input id={`fld-${idx}`} className="input" type={inputType} inputMode={type === "number" ? "numeric" : type === "email" ? "email" : undefined} placeholder={block.placeholder ?? ""} required={block.required} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function ConsentInputs({ items, agreed, setAgreed, accent }: { items: ConsentItem[]; agreed: Record<number, boolean>; setAgreed: (f: (p: Record<number, boolean>) => Record<number, boolean>) => void; accent: string }) {
  if (!items.length) return null;
  return (
    <div className="fr-consent">
      {items.map((it, i) => (
        <ConsentItemRow item={it} key={i}>
          <label className="fr-check">
            <input type="checkbox" checked={Boolean(agreed[i])} style={{ accentColor: accent }} onChange={(e) => setAgreed((p) => ({ ...p, [i]: e.target.checked }))} />{" "}
            {it.title} <span className={it.required ? "req" : "field-optional"}>({it.required ? "필수" : "선택"})</span>
          </label>
        </ConsentItemRow>
      ))}
    </div>
  );
}

function StepFlow(props: {
  sorted: FormBlock[];
  contactMessage: string;
  contactDescription: string;
  consentItems: ConsentItem[];
  values: Record<string, string>;
  setVal: (k: string, v: string) => void;
  choices: Record<number, number[]>;
  setChoices: (f: (p: Record<number, number[]>) => Record<number, number[]>) => void;
  agreed: Record<number, boolean>;
  setAgreed: (f: (p: Record<number, boolean>) => Record<number, boolean>) => void;
  step: number;
  setStep: (f: (s: number) => number) => void;
  style: ReturnType<typeof resolveStyle>;
  submitLabel: string;
  submitting: boolean;
  submitError: string;
  onSubmit: () => void;
  /** 계산기가 붙어 있으면 마지막 단계가 '결과 받기 위한 정보 입력' 화면이 된다. null = 계산기 없음. */
  calcView: CalcView | null;
  calcDisclaimer: string;
  /** 연락처 받기 전 유도 문구(계산기 정의). */
  calcGate: CalculatorDef["gate"] | null;
}) {
  const { sorted, contactMessage, contactDescription, consentItems, values, setVal, choices, setChoices, agreed, setAgreed, step, setStep, style, submitLabel, submitting, submitError, onSubmit, calcView, calcGate } = props;
  const choiceBlocks = sorted.filter((b) => b.blockType === "CHOICE");
  const contactBlocks = sorted.filter((b) => b.blockType === "FIELD");
  /**
   * 단계 구성: [질문 0..n-1] → [마지막 단계]
   *
   * 계산기가 있으면 마지막 단계에 **결과와 연락처를 한 화면에** 둔다 —
   * 결과를 보려고 버튼을 한 번 더 누르게 만들면 그 클릭에서 이탈한다(사용자 결정 2026-08-13).
   */
  const hasCalc = calcView != null;
  const total = choiceBlocks.length + 1;
  const isContact = step >= choiceBlocks.length;
  const [stepError, setStepError] = useState("");
  /**
   * 단일 선택 자동 진행 타이머. step 이 바뀌면(자동 진행 자신이든, "이전"/"다음" 수동 클릭이든)
   * 예약돼 있던 타이머를 정리한다 — 안 그러면 "선택 후 곧장 이전으로 되돌아가기" 같은 경우
   * 엉뚱한 단계에서 타이머가 뒤늦게 발화해 한 번 더 넘어가버린다.
   */
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
  }, [step]);

  function toggle(si: number, oi: number, multi: boolean) {
    setStepError("");
    setChoices((prev) => {
      const cur = prev[si] ?? [];
      const next = multi ? (cur.includes(oi) ? cur.filter((x) => x !== oi) : [...cur, oi]) : [oi];
      return { ...prev, [si]: next };
    });
    // 단일 선택(카드·목록)은 "다음"을 안 눌러도 고르면 바로 다음 단계로 넘어간다.
    // 선택 표시가 아주 잠깐 눈에 보이도록 최소한의 여유(100ms)만 둔다.
    if (!multi) scheduleAdvance();
  }
  function scheduleAdvance() {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    autoAdvanceTimer.current = setTimeout(() => setStep((s) => s + 1), 100);
  }

  // 필수 미응답·형식 오류 시 다음 단계로 진행 차단
  function goNext() {
    const b = choiceBlocks[step];
    // 결과 단계에는 입력이 없다 — 검증 없이 연락처 단계로 넘긴다.
    if (!b) {
      setStepError("");
      setStep((s) => s + 1);
      return;
    }
    if (isCardAnswerType(stepAnswerType(b))) {
      if (b.content?.required === true && (choices[step] ?? []).length === 0) {
        setStepError("이 항목을 선택해주세요.");
        return;
      }
    } else {
      const e = fieldBlockError(choiceAsField(b), values[`s${step}`]);
      if (e) {
        setStepError(e);
        return;
      }
    }
    setStepError("");
    setStep((s) => s + 1);
  }
  function goPrev() {
    setStepError("");
    setStep((s) => s - 1);
  }

  return (
    <div className="sfr">
      <div className="sfr-topbar">
        <div className="sfr-head">
          <span>{isContact ? (hasCalc ? "진단 결과" : "마지막 단계") : `질문 ${step + 1} / ${choiceBlocks.length}`}</span>
          <span>SSL 보안연결</span>
        </div>
        <div className="sfr-progress"><i style={{ width: `${((step + 1) / total) * 100}%`, background: style.accentColor }} /></div>
      </div>

      {!isContact ? (
        (() => {
          const b = choiceBlocks[step];
          const answerType = stepAnswerType(b);
          const multi = answerType === "multi";
          const opts = (b.content?.options as { label?: string; desc?: string }[]) ?? [];
          const sel = choices[step] ?? [];
          return (
            <div>
              <h3 className="t-h3" style={{ marginBottom: 4 }}>
                {(b.content?.question as string) || "질문"} {b.content?.required === true && <span className="req">*</span>}
              </h3>
              {(b.content?.description as string) && (
                <p className={`dash-sub${descEmphasisClass(b.content?.descriptionEmphasis)}`} style={{ marginTop: 0 }}>
                  {b.content?.description as string}
                </p>
              )}
              {isCardAnswerType(answerType) ? (
                <div className="sfr-options">
                  {opts.map((o, i) => (
                    <button key={i} type="button" className={`sfr-opt ${sel.includes(i) ? "sel" : ""}`} style={sel.includes(i) ? { borderColor: style.accentColor, background: `${style.accentColor}1f` } : undefined} onClick={() => toggle(step, i, multi)}>
                      <span className="sfr-opt-t">{o.label || `선택지 ${i + 1}`}</span>
                      {o.desc && <span className="sfr-opt-d">{o.desc}</span>}
                    </button>
                  ))}
                </div>
              ) : (
                // 카드형이 아니면 기본형과 같은 입력 컴포넌트 — 제목은 위 질문이 대신한다.
                <LiveField
                  bare
                  block={choiceAsField(b)}
                  idx={2000 + step}
                  value={values[`s${step}`] ?? ""}
                  onChange={(v) => {
                    setStepError("");
                    setVal(`s${step}`, v);
                    // 라디오는 단일 카드처럼 고르면 바로 다음 단계로 넘어간다.
                    if (answerType === "radio") scheduleAdvance();
                  }}
                  accent={style.accentColor}
                />
              )}
            </div>
          );
        })()
      ) : (
        <div>
          {/* 계산기: 결과를 보려면 정보를 입력해야 한다 — 결과 먼저 보여주면 리드가 안 남는다. */}
          {hasCalc && calcGate ? (
            <CalcGateView
              // 계산기 기본 문구 대신, 마케터가 '마지막 단계·연락처'에 입력한 상단 안내 문구/설명이
              // 있으면 그걸로 덮어쓴다 — 계산기가 붙어도 이 두 입력이 화면에 반영돼야 한다.
              gate={{
                ...calcGate,
                title: contactMessage.trim() ? contactMessage : calcGate.title,
                highlight: contactDescription.trim() ? contactDescription : calcGate.highlight,
              }}
              accentColor={style.accentColor}
            />
          ) : (
            <h3 className="t-h3" style={{ marginBottom: 12 }}>{contactMessage || "연락처를 남겨주세요"}</h3>
          )}
          {!hasCalc && contactDescription && (
            <p className="dash-sub" style={{ marginTop: 0, marginBottom: 12 }}>
              {contactDescription}
            </p>
          )}
          {contactBlocks.map((b, i) => (
            <LiveField key={i} block={b} idx={1000 + i} value={values[`c${i}`] ?? ""} onChange={(v) => setVal(`c${i}`, v)} accent={style.accentColor} />
          ))}
          <ConsentInputs items={consentItems} agreed={agreed} setAgreed={setAgreed} accent={style.accentColor} />
          {submitError && <p className="auth-error">{submitError}</p>}
        </div>
      )}

      {stepError && <p className="auth-error" style={{ marginTop: 12 }}>{stepError}</p>}
      <div className="sfr-nav">
        {step > 0 && <button className="btn btn-ghost" type="button" onClick={goPrev}>이전</button>}
        {isContact ? (
          <button className="btn" type="button" style={{ flex: 1, background: style.buttonColor, color: style.buttonText }} disabled={submitting} onClick={onSubmit}>
            {submitting ? "제출 중…" : submitLabel}
          </button>
        ) : (
          <button className="btn" type="button" style={{ flex: 1, background: style.accentColor, color: style.accentText }} onClick={goNext}>다음</button>
        )}
      </div>
    </div>
  );
}
