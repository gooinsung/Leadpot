import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  createForm,
  getForm,
  listConsentDocs,
  updateForm,
  type BlockType,
  type ConsentDocumentSummary,
  type ConsentItem,
  type FormBlock,
  type FormInput,
  type FormType,
} from "../api/client";
import { TopBar } from "../components/TopBar";
import { FormRenderer } from "../components/formRenderers/FormRenderer";
import { CompletionView } from "../components/formRenderers/CompletionView";
import { ImageUploadField } from "../components/ImageUploadField";

function defaultConsentItems(): ConsentItem[] {
  return [
    { title: "개인정보 수집 및 이용 동의", required: true, defaultChecked: true, linkType: "none" },
    { title: "개인정보 제3자 제공 동의", required: true, defaultChecked: true, linkType: "none" },
    { title: "광고성 정보 수신동의", required: false, defaultChecked: false, linkType: "none" },
  ];
}

const FIELD_TYPES = [
  { value: "text", label: "한 줄 텍스트" },
  { value: "tel", label: "연락처" },
  { value: "email", label: "이메일" },
  { value: "textarea", label: "여러 줄" },
  { value: "number", label: "숫자" },
  { value: "date", label: "날짜" },
  { value: "select", label: "선택박스" },
];

// 스텝형 단계의 답변 방식 (기본형 필드 유형과 동일 계열 + 카드 선택)
const ANSWER_TYPES = [
  { value: "single", label: "단일 선택(카드)" },
  { value: "multi", label: "다중 선택(카드)" },
  { value: "select", label: "선택박스" },
  { value: "text", label: "텍스트" },
  { value: "textarea", label: "장문" },
  { value: "tel", label: "연락처" },
  { value: "email", label: "이메일" },
  { value: "number", label: "숫자" },
  { value: "date", label: "날짜" },
];
const OPTION_ANSWER_TYPES = ["single", "multi", "select"]; // 선택지 목록이 필요한 유형

interface StepData {
  question: string;
  description: string;
  answerType: string;
  placeholder: string;
  required: boolean;
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

  const [name, setName] = useState("새 리드폼");
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
      answerType: "single",
      placeholder: "",
      required: true,
      options: [
        { label: "선택지 1", desc: "" },
        { label: "선택지 2", desc: "" },
      ],
    },
  ]);
  const [contactFields, setContactFields] = useState<FormBlock[]>(defaultContactFields());
  const [contactMessage, setContactMessage] = useState("");

  const [consentItems, setConsentItems] = useState<ConsentItem[]>(defaultConsentItems());
  const [consentDocs, setConsentDocs] = useState<ConsentDocumentSummary[]>([]);
  const [submitLabel, setSubmitLabel] = useState("무료 상담 신청");
  const [buttonColor, setButtonColor] = useState("#12b886");
  const [accentColor, setAccentColor] = useState("#3a43c0");
  const [successMode, setSuccessMode] = useState<"message" | "redirect">("message");
  const [successTitle, setSuccessTitle] = useState("신청이 완료되었습니다");
  const [successMessage, setSuccessMessage] = useState("빠른 시일 내에 연락드리겠습니다.");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [requirePhone, setRequirePhone] = useState(false);
  const [allowSameIp, setAllowSameIp] = useState(true);
  const [ipDedupDays, setIpDedupDays] = useState(0);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isNew) return;
    getForm(Number(id))
      .then((f) => {
        setName(f.name);
        setFormType(f.formType);
        const items = f.consentConfig?.items as ConsentItem[] | undefined;
        setConsentItems(items && items.length ? items : defaultConsentItems());
        setSubmitLabel((f.submitButtonConfig?.label as string) || "무료 상담 신청");
        setButtonColor((f.styleConfig?.buttonColor as string) || "#12b886");
        setAccentColor((f.styleConfig?.accentColor as string) || "#3a43c0");
        const sc = f.successConfig;
        setSuccessMode((sc?.mode as "message" | "redirect") || "message");
        setSuccessTitle((sc?.title as string) || "신청이 완료되었습니다");
        setSuccessMessage((sc?.message as string) ?? "빠른 시일 내에 연락드리겠습니다.");
        setRedirectUrl((sc?.redirectUrl as string) || "");
        setRequirePhone(Boolean(f.requirePhoneVerification));
        setAllowSameIp(f.settingsConfig?.allowSameIp !== false);
        setIpDedupDays(Number(f.settingsConfig?.ipDedupDays) || 0);
        const sorted = [...f.blocks].sort((a, b) => a.sortOrder - b.sortOrder);
        if (f.formType === "STEP") {
          const choiceBlocks = sorted.filter((b) => b.blockType === "CHOICE");
          setSteps(
            choiceBlocks.map((b) => ({
              question: (b.content?.question as string) || "",
              description: (b.content?.description as string) || "",
              answerType: (b.content?.answerType as string) || (b.content?.selectType as string) || "single",
              placeholder: (b.content?.placeholder as string) || "",
              required: b.content?.required === true,
              options: ((b.content?.options as { label: string; desc: string }[]) || []).map((o) => ({
                label: o.label ?? "",
                desc: o.desc ?? "",
              })),
            })),
          );
          setContactFields(sorted.filter((b) => b.blockType === "FIELD"));
          setContactMessage((f.typeConfig?.contactMessage as string) || "");
        } else {
          setBlocks(sorted);
        }
      })
      .catch(() => setError("리드폼을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  // 동의 항목의 '보기' 링크로 연결할 내 동의 문서 목록
  useEffect(() => {
    listConsentDocs().then(setConsentDocs).catch(() => {});
  }, []);

  // ---- 동의 항목 편집 ----
  function patchConsent(i: number, patch: Partial<ConsentItem>) {
    setConsentItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addConsent() {
    setConsentItems((prev) => [...prev, { title: "새 동의 항목", required: false, linkType: "none" }]);
  }
  function removeConsent(i: number) {
    setConsentItems((prev) => prev.filter((_, idx) => idx !== i));
  }

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
      { question: "새 질문", description: "", answerType: "single", placeholder: "", required: true, options: [{ label: "선택지 1", desc: "" }] },
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
              answerType: s.answerType,
              selectType: s.answerType === "multi" ? "multi" : "single", // 하위호환
              placeholder: s.placeholder,
              required: s.required,
              options: OPTION_ANSWER_TYPES.includes(s.answerType) ? s.options : [],
            },
          })),
          ...contactFields.map((f, j) => ({ ...f, stepNo: steps.length, sortOrder: steps.length + j })),
        ];

  const formData: FormInput = {
    name,
    formType,
    requirePhoneVerification: requirePhone,
    consentConfig: { items: consentItems },
    submitButtonConfig: { label: submitLabel },
    successConfig: { mode: successMode, title: successTitle, message: successMessage, redirectUrl },
    styleConfig: { buttonColor, accentColor },
    typeConfig: { contactMessage },
    settingsConfig: { allowSameIp, ipDedupDays },
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
            <p className="eyebrow">{isNew ? "새 리드폼" : "리드폼 편집"}</p>
            <input className="input form-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="edit-actions">
            <button className="btn btn-ghost" onClick={() => navigate("/forms")}>취소</button>
            <button className="btn btn-primary" onClick={onSave} disabled={saving}>
              {saving ? "저장 중…" : "리드폼 저장"}
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
                        <label>답변 방식</label>
                        <select className="input" value={s.answerType} onChange={(e) => patchStep(i, { answerType: e.target.value })}>
                          {ANSWER_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <label className="fr-check" style={{ marginBottom: 10 }}>
                        <input type="checkbox" checked={s.required} onChange={(e) => patchStep(i, { required: e.target.checked })} /> 필수 (답해야 다음 단계로 진행)
                      </label>
                      {OPTION_ANSWER_TYPES.includes(s.answerType) ? (
                        <>
                          <label className="mini-label">선택지</label>
                          {s.options.map((o, oi) => (
                            <div className="opt-row" key={oi}>
                              <input className="input" placeholder="선택지 제목" value={o.label} onChange={(e) => patchOption(i, oi, { label: e.target.value })} />
                              {s.answerType !== "select" && (
                                <input className="input" placeholder="설명(선택)" value={o.desc} onChange={(e) => patchOption(i, oi, { desc: e.target.value })} />
                              )}
                              <button className="btn btn-ghost btn-sm danger" onClick={() => removeOption(i, oi)}>×</button>
                            </div>
                          ))}
                          <button className="btn btn-ghost btn-sm" onClick={() => addOption(i)}>+ 선택지</button>
                        </>
                      ) : (
                        <div className="field">
                          <label>플레이스홀더(선택)</label>
                          <input className="input" value={s.placeholder} onChange={(e) => patchStep(i, { placeholder: e.target.value })} />
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="add-block-row">
                    <button className="btn btn-ghost btn-sm" onClick={addStep}>+ 단계 추가</button>
                  </div>
                </div>

                <div className="card card-pad" style={{ marginTop: 16 }}>
                  <div className="card-h">마지막 단계 · 연락처</div>
                  <div className="field">
                    <label>상단 안내 문구(선택)</label>
                    <input className="input" placeholder="예: 마지막 정보를 입력하면 분석 내용을 바로 보내드립니다!" value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} />
                  </div>
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
              <div className="card-h">동의 항목</div>
              {consentItems.map((it, i) => (
                <div className="block-editor" key={i}>
                  <div className="block-editor-head">
                    <input
                      className="input"
                      style={{ flex: 1, marginRight: 8 }}
                      value={it.title}
                      onChange={(e) => patchConsent(i, { title: e.target.value })}
                    />
                    <button className="btn btn-ghost btn-sm danger" onClick={() => removeConsent(i)}>삭제</button>
                  </div>
                  <div className="block-row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
                    <label className="fr-check">
                      <input type="checkbox" checked={it.required} onChange={(e) => patchConsent(i, { required: e.target.checked })} /> 필수
                    </label>
                    <label className="fr-check">
                      <input type="checkbox" checked={Boolean(it.defaultChecked)} onChange={(e) => patchConsent(i, { defaultChecked: e.target.checked })} /> 기본 체크
                    </label>
                    <div className="field" style={{ flex: 1, marginBottom: 0, minWidth: 140 }}>
                      <label>보기 링크</label>
                      <select
                        className="input"
                        value={it.linkType}
                        onChange={(e) => patchConsent(i, { linkType: e.target.value as ConsentItem["linkType"] })}
                      >
                        <option value="none">없음</option>
                        <option value="external">외부 URL</option>
                        <option value="document">동의 문서</option>
                      </select>
                    </div>
                  </div>
                  {it.linkType === "external" && (
                    <div className="field" style={{ marginTop: 8 }}>
                      <label>URL</label>
                      <input className="input" placeholder="https://…" value={it.url ?? ""} onChange={(e) => patchConsent(i, { url: e.target.value })} />
                    </div>
                  )}
                  {it.linkType === "document" && (
                    <div className="field" style={{ marginTop: 8 }}>
                      <label>연결할 동의 문서</label>
                      <select
                        className="input"
                        value={it.documentId ?? ""}
                        onChange={(e) => patchConsent(i, { documentId: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">문서 선택…</option>
                        {consentDocs.map((d) => (
                          <option key={d.id} value={d.id}>{d.title}</option>
                        ))}
                      </select>
                      <span className="field-optional" style={{ marginTop: 4 }}>
                        <Link to="/consent-docs/new" target="_blank">+ 새 동의 문서 만들기</Link>
                      </span>
                    </div>
                  )}
                </div>
              ))}
              <div className="add-block-row">
                <button className="btn btn-ghost btn-sm" onClick={addConsent}>+ 동의 항목</button>
              </div>
            </div>

            <div className="card card-pad" style={{ marginTop: 16 }}>
              <div className="card-h">제출</div>
              <div className="field">
                <label>제출 버튼 문구</label>
                <input className="input" value={submitLabel} onChange={(e) => setSubmitLabel(e.target.value)} />
              </div>
            </div>

            <div className="card card-pad" style={{ marginTop: 16 }}>
              <div className="card-h">디자인 · 색상</div>
              <ColorField label="제출 버튼 색" value={buttonColor} onChange={setButtonColor} />
              <ColorField label="리드폼 포인트 색 (진행바·선택·강조)" value={accentColor} onChange={setAccentColor} />
            </div>

            <div className="card card-pad" style={{ marginTop: 16 }}>
              <div className="card-h">제출 완료 후</div>
              <div className="field">
                <label>완료 처리</label>
                <select className="input" value={successMode} onChange={(e) => setSuccessMode(e.target.value as "message" | "redirect")}>
                  <option value="message">감사 메시지 표시</option>
                  <option value="redirect">다른 링크로 이동</option>
                </select>
              </div>
              {successMode === "message" ? (
                <>
                  <div className="field">
                    <label>완료 제목</label>
                    <input className="input" value={successTitle} onChange={(e) => setSuccessTitle(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>안내 문구</label>
                    <textarea className="input" rows={2} value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} />
                  </div>
                </>
              ) : (
                <div className="field">
                  <label>이동할 URL</label>
                  <input className="input" placeholder="https://…" value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} />
                </div>
              )}
            </div>

            <div className="card card-pad" style={{ marginTop: 16 }}>
              <div className="card-h">옵션</div>
              <label className="fr-check">
                <input type="checkbox" checked={requirePhone} onChange={(e) => setRequirePhone(e.target.checked)} /> 휴대폰 본인인증 사용
              </label>
              <p className="dash-sub" style={{ marginTop: 6 }}>
                켜면 제출 시 본인인증을 요구합니다. (외부 인증 연동은 추후 제공 — 지금은 옵션 자리)
              </p>
              <div className="dedup-row" style={{ marginTop: 14 }}>
                <label className="fr-check">
                  <input type="checkbox" checked={allowSameIp} onChange={(e) => setAllowSameIp(e.target.checked)} /> 동일 IP 접수 허용
                </label>
                {!allowSameIp && (
                  <div className="dedup-days">
                    <span className="dedup-days-label">차단</span>
                    <input className="input dedup-days-input" type="number" min={0} value={ipDedupDays} onChange={(e) => setIpDedupDays(Number(e.target.value) || 0)} />
                    <span className="dedup-days-label">일 (0=전체)</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="preview-panel">
            <div className="card-h">미리보기</div>
            <div className="preview-frame">
              {requirePhone && <div className="phone-verify-note">🔒 제출 시 휴대폰 본인인증 필요</div>}
              <FormRenderer form={formData} />
            </div>
            <div className="card-h" style={{ marginTop: 18 }}>완료 화면</div>
            <div className="preview-frame">
              <CompletionView config={formData.successConfig} accent={accentColor} />
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

const COLOR_PRESETS = ["#12b886", "#3a43c0", "#f04452", "#f5a524", "#0ea5e9", "#14172a"];

/** 색상 선택 — 프리셋 스와치 + 커스텀 hex. */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="color-field">
      <label className="mini-label">{label}</label>
      <div className="color-row">
        <div className="swatches">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch-btn ${value.toLowerCase() === c ? "on" : ""}`}
              style={{ background: c }}
              onClick={() => onChange(c)}
              aria-label={c}
            />
          ))}
        </div>
        <input type="color" className="color-input" value={value} onChange={(e) => onChange(e.target.value)} />
        <input
          className="input hex-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

/** 항목별 중복 방지 설정: 중복 허용 여부 + 유효 기간(일). block.options 에 저장. */
function DedupField({ block, onPatch }: { block: FormBlock; onPatch: (p: Partial<FormBlock>) => void }) {
  const allow = block.options?.allowDuplicate !== false; // 기본 허용
  const dedupDays = Number(block.options?.dedupDays) || 0;
  function patchOpt(patch: Record<string, unknown>) {
    onPatch({ options: { ...(block.options ?? {}), ...patch } });
  }
  return (
    <div className="select-choices">
      <div className="dedup-row">
        <label className="fr-check">
          <input type="checkbox" checked={allow} onChange={(e) => patchOpt({ allowDuplicate: e.target.checked })} /> 중복 허용
        </label>
        {!allow && (
          <div className="dedup-days">
            <span className="dedup-days-label">중복 방지</span>
            <input className="input dedup-days-input" type="number" min={0} value={dedupDays}
              onChange={(e) => patchOpt({ dedupDays: Number(e.target.value) || 0 })} />
            <span className="dedup-days-label">일 (0=전체)</span>
          </div>
        )}
      </div>
    </div>
  );
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
          <DedupField block={block} onPatch={onPatch} />
        </div>
      );
    case "IMAGE":
      return (
        <ImageUploadField
          url={(block.content?.url as string) ?? ""}
          alt={(block.content?.alt as string) ?? ""}
          onChange={onContent}
        />
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
