import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import {
  ApiError,
  getPublicForm,
  submitLead,
  type ConsentItem,
  type FormBlock,
  type FormDetail,
  type LeadAnswer,
  type LeadConsent,
} from "../api/client";
import { resolveStyle } from "../components/formRenderers/formStyle";
import { CompletionView } from "../components/formRenderers/CompletionView";

function parseUtm(): Record<string, string> {
  const p = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const k of ["source", "medium", "campaign", "term", "content"]) {
    const v = p.get(`utm_${k}`);
    if (v) utm[k] = v;
  }
  return utm;
}

export function PublicFormPage() {
  const { id } = useParams();
  const [form, setForm] = useState<FormDetail | null>(null);
  const [error, setError] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<number, number[]>>({});
  const [agreed, setAgreed] = useState<Record<number, boolean>>({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    getPublicForm(Number(id))
      .then(setForm)
      .catch(() => setError("폼을 찾을 수 없습니다."));
  }, [id]);

  const style = form ? resolveStyle(form) : null;

  const sorted = useMemo(() => (form ? [...form.blocks].sort((a, b) => a.sortOrder - b.sortOrder) : []), [form]);
  const consentItems = (form?.consentConfig?.items as ConsentItem[]) ?? [];

  if (error) return <div className="consent-view"><div className="consent-view-inner"><p className="auth-error">{error}</p></div></div>;
  if (!form || !style) return <div className="page-loading">불러오는 중…</div>;

  const submitLabel = (form.submitButtonConfig?.label as string) || "제출하기";

  function setVal(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function buildAnswers(): LeadAnswer[] {
    const out: LeadAnswer[] = [];
    if (form!.formType === "BASIC") {
      sorted.forEach((b, i) => {
        if (b.blockType === "FIELD") out.push({ label: b.label || `항목 ${i + 1}`, fieldType: b.fieldType ?? "text", value: values[`f${i}`] ?? "" });
      });
    } else {
      const choiceBlocks = sorted.filter((b) => b.blockType === "CHOICE");
      choiceBlocks.forEach((b, i) => {
        const opts = (b.content?.options as { label?: string }[]) ?? [];
        const sel = (choices[i] ?? []).map((oi) => opts[oi]?.label ?? `선택지 ${oi + 1}`);
        out.push({ label: (b.content?.question as string) || `질문 ${i + 1}`, fieldType: "choice", value: sel.join(", ") });
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

  async function onSubmit(e?: FormEvent) {
    e?.preventDefault();
    setSubmitError("");
    // 클라이언트 필수 동의 확인
    const missingConsent = consentItems.some((it, i) => it.required && !agreed[i]);
    if (missingConsent) {
      setSubmitError("필수 동의 항목에 동의해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      await submitLead({ formId: form!.id, answers: buildAnswers(), consents: buildConsents(), utm: parseUtm() });
      const success = form!.successConfig;
      if (success?.mode === "redirect" && success?.redirectUrl) {
        window.location.href = success.redirectUrl as string;
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  // 제출 완료 화면
  if (submitted) {
    return (
      <div className="public-form">
        <div className="public-form-card">
          <CompletionView config={form.successConfig} accent={style.accentColor} />
        </div>
      </div>
    );
  }

  return (
    <div className="public-form">
      <div className="public-form-card">
        <h1 className="public-form-title">{form.name}</h1>
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
            consentItems={consentItems}
            values={values}
            setVal={setVal}
            choices={choices}
            setChoices={setChoices}
            agreed={agreed}
            setAgreed={setAgreed}
            step={step}
            setStep={setStep}
            style={style}
            submitLabel={submitLabel}
            submitting={submitting}
            submitError={submitError}
            onSubmit={onSubmit}
          />
        )}
      </div>
    </div>
  );
}

/** BASIC 블록 — 실제 입력 가능 */
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
        <input id={`fld-${idx}`} className="input" type={inputType} placeholder={block.placeholder ?? ""} required={block.required} value={value} onChange={(e) => onChange(e.target.value)} />
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

/** STEP 실제 진행 흐름 */
function StepFlow(props: {
  sorted: FormBlock[];
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
  const { sorted, consentItems, values, setVal, choices, setChoices, agreed, setAgreed, step, setStep, style, submitLabel, submitting, submitError, onSubmit } = props;
  const choiceBlocks = sorted.filter((b) => b.blockType === "CHOICE");
  const contactBlocks = sorted.filter((b) => b.blockType === "FIELD");
  const total = choiceBlocks.length + 1;
  const isContact = step >= choiceBlocks.length;

  function toggle(si: number, oi: number, multi: boolean) {
    setChoices((prev) => {
      const cur = prev[si] ?? [];
      const next = multi ? (cur.includes(oi) ? cur.filter((x) => x !== oi) : [...cur, oi]) : [oi];
      return { ...prev, [si]: next };
    });
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
          const multi = (b.content?.selectType as string) === "multi";
          const opts = (b.content?.options as { label?: string; desc?: string }[]) ?? [];
          const sel = choices[step] ?? [];
          return (
            <div>
              <h3 className="t-h3" style={{ marginBottom: 4 }}>{(b.content?.question as string) || "질문"}</h3>
              {(b.content?.description as string) && <p className="dash-sub" style={{ marginTop: 0 }}>{b.content?.description as string}</p>}
              <div className="sfr-options">
                {opts.map((o, i) => (
                  <button key={i} type="button" className={`sfr-opt ${sel.includes(i) ? "sel" : ""}`} style={sel.includes(i) ? { borderColor: style.accentColor, background: `${style.accentColor}1f` } : undefined} onClick={() => toggle(step, i, multi)}>
                    <span className="sfr-opt-t">{o.label || `선택지 ${i + 1}`}</span>
                    {o.desc && <span className="sfr-opt-d">{o.desc}</span>}
                  </button>
                ))}
              </div>
            </div>
          );
        })()
      ) : (
        <div>
          <h3 className="t-h3" style={{ marginBottom: 12 }}>연락처를 남겨주세요</h3>
          {contactBlocks.map((b, i) => (
            <LiveField key={i} block={b} idx={1000 + i} value={values[`c${i}`] ?? ""} onChange={(v) => setVal(`c${i}`, v)} />
          ))}
          <ConsentInputs items={consentItems} agreed={agreed} setAgreed={setAgreed} accent={style.accentColor} />
          {submitError && <p className="auth-error">{submitError}</p>}
        </div>
      )}

      <div className="sfr-nav">
        {step > 0 && <button className="btn btn-ghost" type="button" onClick={() => setStep((s) => s - 1)}>이전</button>}
        {isContact ? (
          <button className="btn" type="button" style={{ flex: 1, background: style.buttonColor, color: style.buttonText }} disabled={submitting} onClick={onSubmit}>
            {submitting ? "제출 중…" : submitLabel}
          </button>
        ) : (
          <button className="btn" type="button" style={{ flex: 1, background: style.accentColor, color: style.accentText }} onClick={() => setStep((s) => s + 1)}>다음</button>
        )}
      </div>
    </div>
  );
}
