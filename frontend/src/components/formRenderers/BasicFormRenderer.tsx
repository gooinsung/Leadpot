import type { FormBlock, FormInput } from "../../api/client";
import { HtmlBlock } from "../HtmlBlock";
import { ConsentView } from "./ConsentView";
import { PhoneInput3 } from "../PhoneInput3";
import { resolveStyle } from "./formStyle";

/** BASIC 유형 리드폼 렌더러 — 블록을 순서대로 그려 실제 제출 화면처럼 미리보기. */
export function BasicFormRenderer({ form }: { form: FormInput }) {
  const blocks = [...form.blocks].sort((a, b) => a.sortOrder - b.sortOrder);
  const submitLabel = (form.submitButtonConfig?.label as string) || "제출하기";
  const s = resolveStyle(form);

  return (
    <div className="fr">
      {blocks.map((b, i) => (
        <BlockView key={b.id ?? i} block={b} />
      ))}

      <ConsentView config={form.consentConfig} accent={s.accentColor} />

      <button
        className="btn"
        style={{ width: "100%", marginTop: 8, background: s.buttonColor, color: s.buttonText }}
        type="button"
      >
        {submitLabel}
      </button>
    </div>
  );
}

function BlockView({ block }: { block: FormBlock }) {
  switch (block.blockType) {
    case "FIELD":
      return <FieldView block={block} />;
    case "IMAGE": {
      const url = block.content?.url as string | undefined;
      const alt = (block.content?.alt as string) || "";
      return url ? (
        <img className="fr-img" src={url} alt={alt} />
      ) : (
        <div className="fr-img-ph">이미지 (URL 없음)</div>
      );
    }
    case "HTML": {
      const html = (block.content?.html as string) || "";
      return <HtmlBlock className="fr-html" html={html} />;
    }
    case "TEXT":
      return <p className="fr-text">{(block.content?.text as string) || ""}</p>;
    case "DIVIDER":
      return <hr className="fr-divider" />;
    case "SPACER":
      return <div style={{ height: 24 }} />;
    default:
      return null;
  }
}

function FieldView({ block }: { block: FormBlock }) {
  const type = block.fieldType || "text";
  const inputType =
    type === "email" ? "email" : type === "tel" || type === "phone010" ? "tel" : type === "number" ? "number" : type === "date" ? "date" : "text";
  const choices = (block.options?.choices as string[]) ?? [];
  // 기본 선택(defaultIndex) 을 미리보기에도 반영 — 편집 중 바로 확인할 수 있게 한다.
  const di = block.options?.defaultIndex;
  const defaultChoice = typeof di === "number" && choices[di] != null ? choices[di] : "";
  return (
    <div className="field">
      <label>
        {block.label || "(제목 없음)"} {block.required && <span className="req">*</span>}
      </label>
      {type === "textarea" ? (
        <textarea className="input" placeholder={block.placeholder ?? ""} rows={3} readOnly />
      ) : type === "select" ? (
        <select className="input" value={defaultChoice} onChange={() => {}}>
          <option value="" disabled>
            {block.placeholder || "선택하세요"}
          </option>
          {choices.map((c, i) => (
            <option key={i} value={c}>{c || `선택지 ${i + 1}`}</option>
          ))}
        </select>
      ) : type === "tel" ? (
        <PhoneInput3 value="" onChange={() => {}} readOnly />
      ) : (
        <input className="input" type={inputType} placeholder={block.placeholder ?? ""} readOnly />
      )}
    </div>
  );
}
