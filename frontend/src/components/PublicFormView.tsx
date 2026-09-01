import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { resolveStyle } from "./formRenderers/formStyle";
import { PhoneInput3 } from "./PhoneInput3";
import { consentDocUrl } from "../lib/site";
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
    const answerType = (b.content?.answerType as string) || (b.content?.selectType as string) || "single";
    if (answerType === "single" || answerType === "multi") {
      const opts = (b.content?.options as { label?: string; value?: string }[]) ?? [];
      const picked = (choices[i] ?? []).map((oi) => opts[oi]?.value ?? opts[oi]?.label ?? "").filter(Boolean);
      // 미선택은 키를 넣지 않는다 — 계산기가 '미입력'과 '0'을 구분해 전제 경고를 붙인다.
      if (picked.length) raw[key] = picked.join(",");
    } else {
      const v = (values[`s${i}`] ?? "").trim();
      if (v) raw[key] = v;
    }
  });
  return raw;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_RE = /^[0-9+\-()\s]+$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

/** 항목 유형별 유효성 검사. 에러 메시지(문자열) 또는 null(통과) 반환. */
function fieldError(fieldType: string, value: string, required: boolean, label: string): string | null {
  const v = (value ?? "").trim();
  const name = label && label.trim() ? label : "이 항목";
  if (!v) return required ? `'${name}' 항목을 입력해주세요.` : null;
  if (fieldType === "email" && !EMAIL_RE.test(v)) return `'${name}' 이메일 형식이 올바르지 않습니다.`;
  if (fieldType === "tel") {
    const digits = v.replace(/\D/g, "");
    if (!TEL_RE.test(v) || digits.length < 9 || digits.length > 15) return `'${name}' 연락처는 숫자로 올바르게 입력해주세요.`;
  }
  if (fieldType === "number" && !NUMBER_RE.test(v)) return `'${name}' 는 숫자만 입력할 수 있습니다.`;
  return null;
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
        if (b.blockType !== "FIELD" || b.fieldType !== "select") return;
        const list = (b.options?.choices as string[]) ?? [];
        const di = b.options?.defaultIndex;
        if (typeof di === "number" && list[di] != null) initValues[`f${i}`] = list[di];
      });
    } else {
      sorted.filter((b) => b.blockType === "CHOICE").forEach((b, i) => {
        const answerType = (b.content?.answerType as string) || (b.content?.selectType as string) || "single";
        const di = b.content?.defaultIndex;
        if (typeof di !== "number") return;
        const opts = (b.content?.options as { label?: string }[]) ?? [];
        if (opts[di] == null) return;
        if (answerType === "single" || answerType === "multi") initChoices[i] = [di];
        else if (answerType === "select") initValues[`s${i}`] = opts[di].label ?? "";
      });
    }
    if (Object.keys(initValues).length) setValues((prev) => ({ ...initValues, ...prev }));
    if (Object.keys(initChoices).length) setChoices((prev) => ({ ...initChoices, ...prev }));
  }, [form.formType, sorted]);
  const submitLabel = (form.submitButtonConfig?.label as string) || "제출하기";

  function setVal(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function buildAnswers(): LeadAnswer[] {
    const out: LeadAnswer[] = [];
    if (form.formType === "BASIC") {
      sorted.forEach((b, i) => {
        if (b.blockType === "FIELD")
          out.push({ label: b.label || `항목 ${i + 1}`, fieldType: b.fieldType ?? "text", value: values[`f${i}`] ?? "" });
      });
    } else {
      const choiceBlocks = sorted.filter((b) => b.blockType === "CHOICE");
      choiceBlocks.forEach((b, i) => {
        const answerType = (b.content?.answerType as string) || (b.content?.selectType as string) || "single";
        let value: string;
        if (answerType === "single" || answerType === "multi") {
          const opts = (b.content?.options as { label?: string }[]) ?? [];
          value = (choices[i] ?? []).map((oi) => opts[oi]?.label ?? `선택지 ${oi + 1}`).join(", ");
        } else {
          value = values[`s${i}`] ?? "";
        }
        out.push({ label: (b.content?.question as string) || `질문 ${i + 1}`, fieldType: answerType, value });
      });
      sorted.filter((b) => b.blockType === "FIELD").forEach((b, i) => {
        out.push({ label: b.label || `항목 ${i + 1}`, fieldType: b.fieldType ?? "text", value: values[`c${i}`] ?? "" });
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
        const e = fieldError(b.fieldType || "text", values[`f${i}`] ?? "", !!b.required, b.label || "");
        if (e) return e;
      }
    } else {
      const choiceBlocks = sorted.filter((b) => b.blockType === "CHOICE");
      for (let i = 0; i < choiceBlocks.length; i++) {
        const b = choiceBlocks[i];
        const answerType = (b.content?.answerType as string) || (b.content?.selectType as string) || "single";
        const required = b.content?.required === true;
        const label = (b.content?.question as string) || "질문";
        if (answerType === "single" || answerType === "multi") {
          if (required && (choices[i] ?? []).length === 0) return `'${label}' 항목을 선택해주세요.`;
        } else {
          const e = fieldError(answerType, values[`s${i}`] ?? "", required, label);
          if (e) return e;
        }
      }
      const contactBlocks = sorted.filter((b) => b.blockType === "FIELD");
      for (let i = 0; i < contactBlocks.length; i++) {
        const b = contactBlocks[i];
        const e = fieldError(b.fieldType || "text", values[`c${i}`] ?? "", !!b.required, b.label || "");
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
            <LiveBlock key={i} block={b} idx={i} value={values[`f${i}`] ?? ""} onChange={(v) => setVal(`f${i}`, v)} />
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

function LiveBlock({ block, idx, value, onChange }: { block: FormBlock; idx: number; value: string; onChange: (v: string) => void }) {
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
      return <LiveField block={block} idx={idx} value={value} onChange={onChange} />;
    default:
      return null;
  }
}

function LiveField({ block, idx, value, onChange }: { block: FormBlock; idx: number; value: string; onChange: (v: string) => void }) {
  const type = block.fieldType || "text";
  const choices = (block.options?.choices as string[]) ?? [];
  const inputType = type === "email" ? "email" : type === "tel" ? "tel" : type === "number" ? "number" : type === "date" ? "date" : "text";
  return (
    <div className="field">
      <label htmlFor={`fld-${idx}`}>
        {block.label || "(제목 없음)"} {block.required && <span className="req">*</span>}
      </label>
      {(block.content?.description as string) && (
        <p className={`field-desc${block.content?.descriptionEmphasis ? " emphasis" : ""}`}>{block.content?.description as string}</p>
      )}
      {type === "textarea" ? (
        <textarea id={`fld-${idx}`} className="input" rows={3} placeholder={block.placeholder ?? ""} required={block.required} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : type === "select" ? (
        <select id={`fld-${idx}`} className="input" required={block.required} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{block.placeholder || "선택하세요"}</option>
          {choices.map((c, i) => <option key={i} value={c}>{c || `선택지 ${i + 1}`}</option>)}
        </select>
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
  function href(it: ConsentItem): string | null {
    if (it.linkType === "external" && it.url) return it.url;
    // 앱 도메인 절대 URL로 고정한다 — 상대 경로는 서브도메인 사이트·외부 임베드에서 404 (lib/site.ts 주석)
    if (it.linkType === "document" && it.documentId) return consentDocUrl(it.documentId);
    return null;
  }
  return (
    <div className="fr-consent">
      {items.map((it, i) => (
        <div className="fr-consent-row" key={i}>
          <label className="fr-check">
            <input type="checkbox" checked={Boolean(agreed[i])} style={{ accentColor: accent }} onChange={(e) => setAgreed((p) => ({ ...p, [i]: e.target.checked }))} />{" "}
            {it.title} <span className={it.required ? "req" : "field-optional"}>({it.required ? "필수" : "선택"})</span>
          </label>
          {href(it) && <a className="fr-view-link" href={href(it)!} target="_blank" rel="noreferrer">보기</a>}
        </div>
      ))}
    </div>
  );
}

function StepFlow(props: {
  sorted: FormBlock[];
  contactMessage: string;
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
  const { sorted, contactMessage, consentItems, values, setVal, choices, setChoices, agreed, setAgreed, step, setStep, style, submitLabel, submitting, submitError, onSubmit, calcView, calcGate } = props;
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

  function toggle(si: number, oi: number, multi: boolean) {
    setStepError("");
    setChoices((prev) => {
      const cur = prev[si] ?? [];
      const next = multi ? (cur.includes(oi) ? cur.filter((x) => x !== oi) : [...cur, oi]) : [oi];
      return { ...prev, [si]: next };
    });
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
    const answerType = (b.content?.answerType as string) || (b.content?.selectType as string) || "single";
    const required = b.content?.required === true;
    const isChoice = answerType === "single" || answerType === "multi";
    if (isChoice) {
      if (required && (choices[step] ?? []).length === 0) {
        setStepError("이 항목을 선택해주세요.");
        return;
      }
    } else {
      const label = (b.content?.question as string) || "";
      const e = fieldError(answerType, values[`s${step}`] ?? "", required, label);
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
          const answerType = (b.content?.answerType as string) || (b.content?.selectType as string) || "single";
          const multi = answerType === "multi";
          const opts = (b.content?.options as { label?: string; desc?: string }[]) ?? [];
          const sel = choices[step] ?? [];
          const placeholder = (b.content?.placeholder as string) || "";
          const inputVal = values[`s${step}`] ?? "";
          return (
            <div>
              <h3 className="t-h3" style={{ marginBottom: 4 }}>
                {(b.content?.question as string) || "질문"} {b.content?.required === true && <span className="req">*</span>}
              </h3>
              {(b.content?.description as string) && <p className="dash-sub" style={{ marginTop: 0 }}>{b.content?.description as string}</p>}
              {answerType === "single" || answerType === "multi" ? (
                <div className="sfr-options">
                  {opts.map((o, i) => (
                    <button key={i} type="button" className={`sfr-opt ${sel.includes(i) ? "sel" : ""}`} style={sel.includes(i) ? { borderColor: style.accentColor, background: `${style.accentColor}1f` } : undefined} onClick={() => toggle(step, i, multi)}>
                      <span className="sfr-opt-t">{o.label || `선택지 ${i + 1}`}</span>
                      {o.desc && <span className="sfr-opt-d">{o.desc}</span>}
                    </button>
                  ))}
                </div>
              ) : answerType === "select" ? (
                <div className="sfr-field">
                  <select className="input" value={inputVal} onChange={(e) => setVal(`s${step}`, e.target.value)}>
                    <option value="">{placeholder || "선택하세요"}</option>
                    {opts.map((o, i) => <option key={i} value={o.label}>{o.label || `선택지 ${i + 1}`}</option>)}
                  </select>
                </div>
              ) : answerType === "textarea" ? (
                <div className="sfr-field">
                  <textarea className="input" rows={4} placeholder={placeholder} value={inputVal} onChange={(e) => setVal(`s${step}`, e.target.value)} />
                </div>
              ) : (
                <div className="sfr-field">
                  <input className="input" type={answerType === "tel" ? "tel" : answerType === "email" ? "email" : answerType === "number" ? "number" : answerType === "date" ? "date" : "text"} inputMode={answerType === "tel" ? "tel" : answerType === "number" ? "numeric" : answerType === "email" ? "email" : undefined} placeholder={placeholder} value={inputVal} onChange={(e) => setVal(`s${step}`, e.target.value)} />
                </div>
              )}
            </div>
          );
        })()
      ) : (
        <div>
          {/* 계산기: 결과를 보려면 정보를 입력해야 한다 — 결과 먼저 보여주면 리드가 안 남는다. */}
          {hasCalc && calcGate ? (
            <CalcGateView gate={calcGate} accentColor={style.accentColor} />
          ) : (
            <h3 className="t-h3" style={{ marginBottom: 12 }}>{contactMessage || "연락처를 남겨주세요"}</h3>
          )}
          {contactBlocks.map((b, i) => (
            <LiveField key={i} block={b} idx={1000 + i} value={values[`c${i}`] ?? ""} onChange={(v) => setVal(`c${i}`, v)} />
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
            {submitting ? "제출 중…" : (calcGate?.submitLabel || submitLabel)}
          </button>
        ) : (
          <button className="btn" type="button" style={{ flex: 1, background: style.accentColor, color: style.accentText }} onClick={goNext}>다음</button>
        )}
      </div>
    </div>
  );
}
