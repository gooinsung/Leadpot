import type { FormBlock, FormInput } from "../../api/client";

/** BASIC 유형 폼 렌더러 — 블록을 순서대로 그려 실제 제출 화면처럼 미리보기. */
export function BasicFormRenderer({ form }: { form: FormInput }) {
  const blocks = [...form.blocks].sort((a, b) => a.sortOrder - b.sortOrder);
  const submitLabel = (form.submitButtonConfig?.label as string) || "제출하기";
  const consent = form.consentConfig ?? {};

  return (
    <div className="fr">
      {blocks.map((b, i) => (
        <BlockView key={b.id ?? i} block={b} />
      ))}

      {("privacy" in consent || "marketing" in consent) && (
        <div className="fr-consent">
          {"privacy" in consent && (
            <label className="fr-check">
              <input type="checkbox" defaultChecked readOnly /> 개인정보 수집·이용에 동의합니다{" "}
              <span className="req">*</span>
            </label>
          )}
          {"marketing" in consent && (
            <label className="fr-check">
              <input type="checkbox" readOnly /> 마케팅 정보 수신에 동의합니다 (선택)
            </label>
          )}
        </div>
      )}

      <button className="btn btn-green" style={{ width: "100%", marginTop: 8 }} type="button">
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
      return <div className="fr-html" dangerouslySetInnerHTML={{ __html: html }} />;
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
  return (
    <div className="field">
      <label>
        {block.label || "(제목 없음)"} {block.required && <span className="req">*</span>}
      </label>
      {type === "textarea" ? (
        <textarea className="input" placeholder={block.placeholder ?? ""} rows={3} readOnly />
      ) : (
        <input className="input" type={inputType} placeholder={block.placeholder ?? ""} readOnly />
      )}
    </div>
  );
}
