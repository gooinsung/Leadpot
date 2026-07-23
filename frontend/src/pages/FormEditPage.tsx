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
  type FormType,
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
  { value: "select", label: "선택박스" },
];

interface StepData {
  question: string;
  description: string;
  selectType: "single" | "multi";
  options: { label: string; desc: string }[];
}

function newBlock(blockType: BlockType): FormBlock {
  const base: FormBlock = { sortOrder: 0, blockType };
  if (blockType === "FIELD") return { ...base, fieldType: "text", label: "새 항목", required: false };
  if (blockType === "IMAGE") return { ...base, content: { url: "", alt: "" } };
  if (blockType === "HTML") return { ...base, content: { html: "<p>안내 문구</p>" } };
  if (blockType === "TEXT") return { ...base, content: { text: "텍스트" } };
  return base;
}

function defaultContactFields(): FormBlock[] {
  return [
    { sortOrder: 0, blockType: "FIELD", fieldType: "text", label: "이름", required: true, placeholder: "홍길동" },
    { sortOrder: 1, blockType: "FIELD", fieldType: "tel", label: "연락처", required: true, placeholder: "010-0000-0000" },
  ];
}

export function FormEditPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [name, setName] = useState("새 폼");
  const [formType, setFormType] = useState<FormType>("BASIC");

  // BASIC: 평면 블록 배열
  const [blocks, setBlocks] = useState<FormBlock[]>([
    { sortOrder: 0, blockType: "FIELD", fieldType: "text", label: "이름", required: true, placeholder: "홍길동" },
    { sortOrder: 1, blockType: "FIELD", fieldType: "tel", label: "연락처", required: true, placeholder: "010-0000-0000" },
  ]);

  // STEP: 질문 단계 + 마지막 연락처 단계
  const [steps, setSteps] = useState<StepData[]>([
    {
      question: "현재 가장 어려운 점은 무엇인가요?",
      description: "",
      selectType: "single",
      options: [
        { label: "선택지 1", desc: "" },
        { label: "선택지 2", desc: "" },
      ],
    },
  ]);
  const [contactFields, setContactFields] = useState<FormBlock[]>(defaultContactFields());

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
        setFormType(f.formType);
        setPrivacy(Boolean(f.consentConfig?.privacy));
        setMarketing(Boolean(f.consentConfig?.marketing));
        setSubmitLabel((f.submitButtonConfig?.label as string) || "무료 상담 신청");
        const sorted = [...f.blocks].sort((a, b) => a.sortOrder - b.sortOrder);
        if (f.formType === "STEP") {
          const choiceBlocks = sorted.filter((b) => b.blockType === "CHOICE");
          setSteps(
            choiceBlocks.map((b) => ({
              question: (b.content?.question as string) || "",
              description: (b.content?.description as string) || "",
              selectType: (b.content?.selectType as "single" | "multi") || "single",
              options: ((b.content?.options as { label: string; desc: string }[]) || []).map((o) => ({
                label: o.label ?? "",
                desc: o.desc ?? "",
              })),
            })),
          );
          setContactFields(sorted.filter((b) => b.blockType === "FIELD"));
        } else {
          setBlocks(sorted);
        }
      })
      .catch(() => setError("폼을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  // ---- BASIC 블록 편집 ----
  function patchBlock(i: number, patch: Partial<FormBlock>) {
    setBlocks((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }
  function patchBlockContent(i: number, patch: Record<string, unknown>) {
    setBlocks((prev) => prev.map((b, idx) => (idx === i ? { ...b, content: { ...(b.content ?? {}), ...patch } } : b)));
  }
  function addBlock(type: BlockType) {
    setBlocks((prev) => [...prev, newBlock(type)]);
  }
  function removeBlock(i: number) {
    setBlocks((prev) => prev.filter((_, idx) => idx !== i));
  }
  function moveBlock(i: number, dir: -1 | 1) {
    setBlocks((prev) => swap(prev, i, i + dir));
  }

  // ---- STEP 편집 ----
  function patchStep(i: number, patch: Partial<StepData>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addStep() {
    setSteps((prev) => [
      ...prev,
      { question: "새 질문", description: "", selectType: "single", options: [{ label: "선택지 1", desc: "" }] },
    ]);
  }
  function removeStep(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }
  function moveStep(i: number, dir: -1 | 1) {
    setSteps((prev) => swap(prev, i, i + dir));
  }
  function patchOption(si: number, oi: number, patch: Partial<{ label: string; desc: string }>) {
    setSteps((prev) =>
      prev.map((s, idx) =>
        idx === si ? { ...s, options: s.options.map((o, oidx) => (oidx === oi ? { ...o, ...patch } : o)) } : s,
      ),
    );
  }
  function addOption(si: number) {
    setSteps((prev) =>
      prev.map((s, idx) => (idx === si ? { ...s, options: [...s.options, { label: "", desc: "" }] } : s)),
    );
  }
  function removeOption(si: number, oi: number) {
    setSteps((prev) =>
      prev.map((s, idx) => (idx === si ? { ...s, options: s.options.filter((_, oidx) => oidx !== oi) } : s)),
    );
  }

  // ---- 연락처 필드(STEP 마지막 단계) ----
  function patchContact(i: number, patch: Partial<FormBlock>) {
    setContactFields((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }
  function addContact() {
    setContactFields((prev) => [...prev, { sortOrder: 0, blockType: "FIELD", fieldType: "text", label: "새 항목", required: false }]);
  }
  function removeContact(i: number) {
    setContactFields((prev) => prev.filter((_, idx) => idx !== i));
  }

  // ---- 저장 데이터 조립 ----
  const builtBlocks: FormBlock[] =
    formType === "BASIC"
      ? blocks.map((b, i) => ({ ...b, sortOrder: i, stepNo: null }))
      : [
          ...steps.map((s, i) => ({
            sortOrder: i,
            stepNo: i,
            blockType: "CHOICE" as BlockType,
            content: {
              question: s.question,
              description: s.description,
              selectType: s.selectType,
              options: s.options,
            },
          })),
          ...contactFields.map((f, j) => ({ ...f, stepNo: steps.length, sortOrder: steps.length + j })),
        ];

  const formData: FormInput = {
    name,
    formType,
    requirePhoneVerification: false,
    consentConfig: { privacy, marketing },
    submitButtonConfig: { label: submitLabel },
    blocks: builtBlocks,
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
            <p className="eyebrow">{isNew ? "새 폼" : "폼 편집"}</p>
            <input className="input form-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="edit-actions">
            <button className="btn btn-ghost" onClick={() => navigate("/forms")}>취소</button>
            <button className="btn btn-primary" onClick={onSave} disabled={saving}>
              {saving ? "저장 중…" : "폼 저장"}
            </button>
          </div>
        </div>

        {/* 유형 선택 */}
        <div className="type-seg">
          <button className={formType === "BASIC" ? "on" : ""} onClick={() => setFormType("BASIC")}>기본형</button>
          <button className={formType === "STEP" ? "on" : ""} onClick={() => setFormType("STEP")}>스텝형(선택)</button>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <div className="edit-grid">
          <div className="edit-panel">
            {formType === "BASIC" ? (
              <div className="card card-pad">
                <div className="card-h">본문 블록</div>
                {blocks.map((b, i) => (
                  <div className="block-editor" key={i}>
                    <div className="block-editor-head">
                      <span className="pill">{blockTypeLabel(b.blockType)}</span>
                      <div className="block-editor-ctrl">
                        <button className="btn btn-ghost btn-sm" onClick={() => moveBlock(i, -1)} disabled={i === 0}>↑</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1}>↓</button>
                        <button className="btn btn-ghost btn-sm danger" onClick={() => removeBlock(i)}>삭제</button>
                      </div>
                    </div>
                    <BlockFields block={b} onPatch={(p) => patchBlock(i, p)} onContent={(p) => patchBlockContent(i, p)} />
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
            ) : (
              <>
                <div className="card card-pad">
                  <div className="card-h">질문 단계</div>
                  {steps.map((s, i) => (
                    <div className="block-editor" key={i}>
                      <div className="block-editor-head">
                        <span className="pill i">단계 {i + 1}</span>
                        <div className="block-editor-ctrl">
                          <button className="btn btn-ghost btn-sm" onClick={() => moveStep(i, -1)} disabled={i === 0}>↑</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1}>↓</button>
                          <button className="btn btn-ghost btn-sm danger" onClick={() => removeStep(i)} disabled={steps.length === 1}>삭제</button>
                        </div>
                      </div>
                      <div className="field">
                        <label>질문</label>
                        <input className="input" value={s.question} onChange={(e) => patchStep(i, { question: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>설명(선택)</label>
                        <input className="input" value={s.description} onChange={(e) => patchStep(i, { description: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>선택 방식</label>
                        <select className="input" value={s.selectType} onChange={(e) => patchStep(i, { selectType: e.target.value as "single" | "multi" })}>
                          <option value="single">단일 선택</option>
                          <option value="multi">다중 선택</option>
                        </select>
                      </div>
                      <label className="mini-label">선택지</label>
                      {s.options.map((o, oi) => (
                        <div className="opt-row" key={oi}>
                          <input className="input" placeholder="선택지 제목" value={o.label} onChange={(e) => patchOption(i, oi, { label: e.target.value })} />
                          <input className="input" placeholder="설명(선택)" value={o.desc} onChange={(e) => patchOption(i, oi, { desc: e.target.value })} />
                          <button className="btn btn-ghost btn-sm danger" onClick={() => removeOption(i, oi)}>×</button>
                        </div>
                      ))}
                      <button className="btn btn-ghost btn-sm" onClick={() => addOption(i)}>+ 선택지</button>
                    </div>
                  ))}
                  <div className="add-block-row">
                    <button className="btn btn-ghost btn-sm" onClick={addStep}>+ 단계 추가</button>
                  </div>
                </div>

                <div className="card card-pad" style={{ marginTop: 16 }}>
                  <div className="card-h">마지막 단계 · 연락처</div>
                  {contactFields.map((b, i) => (
                    <div className="block-editor" key={i}>
                      <div className="block-editor-head">
                        <span className="pill">입력 항목</span>
                        <button className="btn btn-ghost btn-sm danger" onClick={() => removeContact(i)}>삭제</button>
                      </div>
                      <BlockFields block={b} onPatch={(p) => patchContact(i, p)} onContent={() => {}} />
                    </div>
                  ))}
                  <div className="add-block-row">
                    <button className="btn btn-ghost btn-sm" onClick={addContact}>+ 입력 항목</button>
                  </div>
                </div>
              </>
            )}

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

function swap<T>(arr: T[], i: number, j: number): T[] {
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function blockTypeLabel(t: BlockType): string {
  return { FIELD: "입력 항목", IMAGE: "이미지", HTML: "HTML", TEXT: "텍스트", DIVIDER: "구분선", SPACER: "여백", CHOICE: "선택지" }[t];
}

/** 선택박스(select) 필드의 선택지 목록 편집. block.options.choices(string[]) 에 저장. */
function SelectChoicesEditor({ block, onPatch }: { block: FormBlock; onPatch: (p: Partial<FormBlock>) => void }) {
  const choices = ((block.options?.choices as string[]) ?? []);
  function setChoices(next: string[]) {
    onPatch({ options: { ...(block.options ?? {}), choices: next } });
  }
  return (
    <div className="select-choices">
      <label className="mini-label">선택지 목록</label>
      {choices.map((c, i) => (
        <div className="opt-row" key={i}>
          <input
            className="input"
            placeholder={`선택지 ${i + 1}`}
            value={c}
            onChange={(e) => setChoices(choices.map((x, idx) => (idx === i ? e.target.value : x)))}
          />
          <button className="btn btn-ghost btn-sm danger" type="button" onClick={() => setChoices(choices.filter((_, idx) => idx !== i))}>×</button>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setChoices([...choices, ""])}>+ 선택지</button>
    </div>
  );
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
          {block.fieldType === "select" && <SelectChoicesEditor block={block} onPatch={onPatch} />}
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
