import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { CompletionView } from "./formRenderers/CompletionView";

function parseUtm(): Record<string, string> {
  const p = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const k of ["source", "medium", "campaign", "term", "content"]) {
    const v = p.get(`utm_${k}`);
    if (v) utm[k] = v;
  }
  return utm;
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
 * 실제 제출 가능한 공개 폼 렌더러(비로그인).
 * 단독 공개 폼(/f/{id})과 랜딩(/p/{slug}) 인라인·오버레이에서 공용으로 사용.
 */
export function PublicFormView({
  form,
  landingPageId,
  onSubmitted,
}: {
  form: FormDetail;
  landingPageId?: number | null;
  onSubmitted?: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<number, number[]>>({});
  const [agreed, setAgreed] = useState<Record<number, boolean>>({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

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
      const success = form.successConfig;
      if (success?.mode === "redirect" && success?.redirectUrl) {
        window.location.href = success.redirectUrl as string;
        return;
      }
      setSubmitted(true);
      onSubmitted?.();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
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
      return <div className="fr-html" dangerouslySetInnerHTML={{ __html: (block.content?.html as string) || "" }} />;
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
      {type === "textarea" ? (
        <textarea id={`fld-${idx}`} className="input" rows={3} placeholder={block.placeholder ?? ""} required={block.required} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : type === "select" ? (
        <select id={`fld-${idx}`} className="input" required={block.required} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{block.placeholder || "선택하세요"}</option>
          {choices.map((c, i) => <option key={i} value={c}>{c || `선택지 ${i + 1}`}</option>)}
        </select>
      ) : (
        <input id={`fld-${idx}`} className="input" type={inputType} inputMode={type === "tel" ? "tel" : type === "number" ? "numeric" : type === "email" ? "email" : undefined} placeholder={block.placeholder ?? ""} required={block.required} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function ConsentInputs({ items, agreed, setAgreed, accent }: { items: ConsentItem[]; agreed: Record<number, boolean>; setAgreed: (f: (p: Record<number, boolean>) => Record<number, boolean>) => void; accent: string }) {
  if (!items.length) return null;
  function href(it: ConsentItem): string | null {
    if (it.linkType === "external" && it.url) return it.url;
    if (it.linkType === "document" && it.documentId) return `/consent/${it.documentId}`;
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
}) {
  const { sorted, contactMessage, consentItems, values, setVal, choices, setChoices, agreed, setAgreed, step, setStep, style, submitLabel, submitting, submitError, onSubmit } = props;
  const choiceBlocks = sorted.filter((b) => b.blockType === "CHOICE");
  const contactBlocks = sorted.filter((b) => b.blockType === "FIELD");
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
      <div className="sfr-head">
        <span>{isContact ? "마지막 단계" : `질문 ${step + 1} / ${choiceBlocks.length}`}</span>
        <span>SSL 보안연결</span>
      </div>
      <div className="sfr-progress"><i style={{ width: `${((step + 1) / total) * 100}%`, background: style.accentColor }} /></div>

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
          <h3 className="t-h3" style={{ marginBottom: 12 }}>{contactMessage || "연락처를 남겨주세요"}</h3>
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
            {submitting ? "제출 중…" : submitLabel}
          </button>
        ) : (
          <button className="btn" type="button" style={{ flex: 1, background: style.accentColor, color: style.accentText }} onClick={goNext}>다음</button>
        )}
      </div>
    </div>
  );
}
