import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  createForm,
  getForm,
  updateForm,
  type BlockType,
  type FormBlock,
  type FormInput,
} from "../api/client";
import { TopBar } from "../components/TopBar";
import { FormRenderer } from "../components/formRenderers/FormRenderer";

const FIELD_TYPES = [
  { value: "text", label: "한 줄 텍스트" },
  { value: "tel", label: "연락처" },
  { value: "email", label: "이메일" },
  { value: "textarea", label: "여러 줄" },
  { value: "number", label: "숫자" },
  { value: "date", label: "날짜" },
];

function newBlock(blockType: BlockType): FormBlock {
  const base: FormBlock = { sortOrder: 0, blockType };
  if (blockType === "FIELD") return { ...base, fieldType: "text", label: "새 항목", required: false };
  if (blockType === "IMAGE") return { ...base, content: { url: "", alt: "" } };
  if (blockType === "HTML") return { ...base, content: { html: "<p>안내 문구</p>" } };
  if (blockType === "TEXT") return { ...base, content: { text: "텍스트" } };
  return base;
}

export function FormEditPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [name, setName] = useState("새 폼");
  const [blocks, setBlocks] = useState<FormBlock[]>([
    { sortOrder: 0, blockType: "FIELD", fieldType: "text", label: "이름", required: true, placeholder: "홍길동" },
    { sortOrder: 1, blockType: "FIELD", fieldType: "tel", label: "연락처", required: true, placeholder: "010-0000-0000" },
  ]);
  const [privacy, setPrivacy] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [submitLabel, setSubmitLabel] = useState("무료 상담 신청");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isNew) return;
    getForm(Number(id))
      .then((f) => {
        setName(f.name);
        setBlocks([...f.blocks].sort((a, b) => a.sortOrder - b.sortOrder));
        setPrivacy(Boolean(f.consentConfig?.privacy));
        setMarketing(Boolean(f.consentConfig?.marketing));
        setSubmitLabel((f.submitButtonConfig?.label as string) || "무료 상담 신청");
      })
      .catch(() => setError("폼을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function patchBlock(index: number, patch: Partial<FormBlock>) {
    setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }
  function patchContent(index: number, patch: Record<string, unknown>) {
    setBlocks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, content: { ...(b.content ?? {}), ...patch } } : b)),
    );
  }
  function addBlock(type: BlockType) {
    setBlocks((prev) => [...prev, newBlock(type)]);
  }
  function removeBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  }
  function move(index: number, dir: -1 | 1) {
    setBlocks((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  const formData: FormInput = {
    name,
    formType: "BASIC",
    requirePhoneVerification: false,
    consentConfig: { privacy, marketing },
    submitButtonConfig: { label: submitLabel },
    blocks: blocks.map((b, i) => ({ ...b, sortOrder: i })),
  };

  async function onSave() {
    setError("");
    setSaving(true);
    try {
      if (isNew) await createForm(formData);
      else await updateForm(Number(id), formData);
      navigate("/forms");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="page-loading">불러오는 중…</div>;

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap form-edit">
        <div className="dash-head">
          <div>
            <p className="eyebrow">{isNew ? "새 폼" : "폼 편집"} · 기본형</p>
            <input className="input form-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="edit-actions">
            <button className="btn btn-ghost" onClick={() => navigate("/forms")}>취소</button>
            <button className="btn btn-primary" onClick={onSave} disabled={saving}>
              {saving ? "저장 중…" : "폼 저장"}
            </button>
          </div>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <div className="edit-grid">
          {/* 편집 패널 */}
          <div className="edit-panel">
            <div className="card card-pad">
              <div className="card-h">본문 블록</div>
              {blocks.map((b, i) => (
                <div className="block-editor" key={i}>
                  <div className="block-editor-head">
                    <span className="pill">{blockTypeLabel(b.blockType)}</span>
                    <div className="block-editor-ctrl">
                      <button className="btn btn-ghost btn-sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => move(i, 1)} disabled={i === blocks.length - 1}>↓</button>
                      <button className="btn btn-ghost btn-sm danger" onClick={() => removeBlock(i)}>삭제</button>
                    </div>
                  </div>
                  <BlockFields block={b} onPatch={(p) => patchBlock(i, p)} onContent={(p) => patchContent(i, p)} />
                </div>
              ))}

              <div className="add-block-row">
                <button className="btn btn-ghost btn-sm" onClick={() => addBlock("FIELD")}>+ 입력 항목</button>
                <button className="btn btn-ghost btn-sm" onClick={() => addBlock("IMAGE")}>+ 이미지</button>
                <button className="btn btn-ghost btn-sm" onClick={() => addBlock("HTML")}>+ HTML</button>
                <button className="btn btn-ghost btn-sm" onClick={() => addBlock("TEXT")}>+ 텍스트</button>
                <button className="btn btn-ghost btn-sm" onClick={() => addBlock("DIVIDER")}>+ 구분선</button>
              </div>
            </div>

            <div className="card card-pad" style={{ marginTop: 16 }}>
              <div className="card-h">동의 · 제출</div>
              <label className="fr-check">
                <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} /> 개인정보 수집·이용 동의 받기(필수)
              </label>
              <label className="fr-check">
                <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} /> 마케팅 수신 동의 받기(선택)
              </label>
              <div className="field" style={{ marginTop: 12 }}>
                <label>제출 버튼 문구</label>
                <input className="input" value={submitLabel} onChange={(e) => setSubmitLabel(e.target.value)} />
              </div>
            </div>
          </div>

          {/* 미리보기 패널 */}
          <div className="preview-panel">
            <div className="card-h">미리보기</div>
            <div className="preview-frame">
              <FormRenderer form={formData} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function blockTypeLabel(t: BlockType): string {
  return { FIELD: "입력 항목", IMAGE: "이미지", HTML: "HTML", TEXT: "텍스트", DIVIDER: "구분선", SPACER: "여백" }[t];
}

function BlockFields({
  block,
  onPatch,
  onContent,
}: {
  block: FormBlock;
  onPatch: (p: Partial<FormBlock>) => void;
  onContent: (p: Record<string, unknown>) => void;
}) {
  switch (block.blockType) {
    case "FIELD":
      return (
        <div className="block-fields">
          <div className="field">
            <label>항목 이름</label>
            <input className="input" value={block.label ?? ""} onChange={(e) => onPatch({ label: e.target.value })} />
          </div>
          <div className="block-row">
            <div className="field" style={{ flex: 1 }}>
              <label>유형</label>
              <select className="input" value={block.fieldType ?? "text"} onChange={(e) => onPatch({ fieldType: e.target.value })}>
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <label className="fr-check" style={{ alignSelf: "flex-end", paddingBottom: 10 }}>
              <input type="checkbox" checked={Boolean(block.required)} onChange={(e) => onPatch({ required: e.target.checked })} /> 필수
            </label>
          </div>
          <div className="field">
            <label>플레이스홀더</label>
            <input className="input" value={block.placeholder ?? ""} onChange={(e) => onPatch({ placeholder: e.target.value })} />
          </div>
        </div>
      );
    case "IMAGE":
      return (
        <div className="block-fields">
          <div className="field">
            <label>이미지 URL</label>
            <input className="input" value={(block.content?.url as string) ?? ""} onChange={(e) => onContent({ url: e.target.value })} />
          </div>
          <div className="field">
            <label>대체 텍스트</label>
            <input className="input" value={(block.content?.alt as string) ?? ""} onChange={(e) => onContent({ alt: e.target.value })} />
          </div>
        </div>
      );
    case "HTML":
      return (
        <div className="field">
          <label>HTML</label>
          <textarea className="input" rows={3} value={(block.content?.html as string) ?? ""} onChange={(e) => onContent({ html: e.target.value })} />
        </div>
      );
    case "TEXT":
      return (
        <div className="field">
          <label>텍스트</label>
          <textarea className="input" rows={2} value={(block.content?.text as string) ?? ""} onChange={(e) => onContent({ text: e.target.value })} />
        </div>
      );
    default:
      return <p className="dash-sub" style={{ margin: 0 }}>추가 설정 없음</p>;
  }
}
