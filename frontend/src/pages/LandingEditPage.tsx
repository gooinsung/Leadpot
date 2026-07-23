import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  createLanding,
  getLanding,
  listForms,
  updateLanding,
  type FormSummary,
  type LandingBlock,
  type LandingBlockType,
} from "../api/client";
import { TopBar } from "../components/TopBar";

function newBlock(type: LandingBlockType, forms: FormSummary[]): LandingBlock {
  if (type === "IMAGE") return { type, url: "", alt: "" };
  if (type === "TEXT") return { type, text: "텍스트를 입력하세요" };
  if (type === "HTML") return { type, html: "<p>내용</p>" };
  return { type: "FORM", formId: forms[0]?.id ?? null, trigger: "inline", buttonLabel: "상담 신청하기" };
}

export function LandingEditPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [title, setTitle] = useState("새 랜딩");
  const [status, setStatus] = useState("published");
  const [blocks, setBlocks] = useState<LandingBlock[]>([]);
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listForms().then(setForms).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) {
      setBlocks([
        { type: "IMAGE", url: "", alt: "상단 이미지" },
        { type: "FORM", formId: null, trigger: "inline", buttonLabel: "상담 신청하기" },
      ]);
      return;
    }
    getLanding(Number(id))
      .then((l) => {
        setTitle(l.title);
        setStatus(l.status);
        setBlocks(l.content ?? []);
      })
      .catch(() => setError("랜딩을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  // FORM 블록의 기본 formId 를 폼 목록 로드 후 채움(신규)
  useEffect(() => {
    if (forms.length === 0) return;
    setBlocks((prev) => prev.map((b) => (b.type === "FORM" && b.formId == null ? { ...b, formId: forms[0].id } : b)));
  }, [forms]);

  function patch(i: number, p: Partial<LandingBlock>) {
    setBlocks((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...p } : b)));
  }
  function add(type: LandingBlockType) {
    setBlocks((prev) => [...prev, newBlock(type, forms)]);
  }
  function remove(i: number) {
    setBlocks((prev) => prev.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    setBlocks((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function onSave() {
    setError("");
    setSaving(true);
    try {
      const payload = { title, content: blocks, status };
      if (isNew) await createLanding(payload);
      else await updateLanding(Number(id), payload);
      navigate("/landings");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function formName(formId: unknown) {
    return forms.find((f) => f.id === formId)?.name ?? "(폼 선택 안 됨)";
  }

  if (loading) return <div className="page-loading">불러오는 중…</div>;

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap form-edit">
        <div className="dash-head">
          <div>
            <p className="eyebrow">{isNew ? "새 랜딩" : "랜딩 편집"}</p>
            <input className="input form-name" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="edit-actions">
            <select className="input" style={{ width: 110 }} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="published">공개</option>
              <option value="draft">비공개</option>
            </select>
            <button className="btn btn-ghost" onClick={() => navigate("/landings")}>취소</button>
            <button className="btn btn-primary" onClick={onSave} disabled={saving}>{saving ? "저장 중…" : "랜딩 저장"}</button>
          </div>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <div className="edit-grid">
          {/* 편집 */}
          <div className="edit-panel">
            <div className="card card-pad">
              <div className="card-h">페이지 블록</div>
              {blocks.map((b, i) => (
                <div className="block-editor" key={i}>
                  <div className="block-editor-head">
                    <span className={`pill ${b.type === "FORM" ? "g" : ""}`}>{blockLabel(b.type)}</span>
                    <div className="block-editor-ctrl">
                      <button className="btn btn-ghost btn-sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => move(i, 1)} disabled={i === blocks.length - 1}>↓</button>
                      <button className="btn btn-ghost btn-sm danger" onClick={() => remove(i)}>삭제</button>
                    </div>
                  </div>
                  {b.type === "IMAGE" && (
                    <>
                      <div className="field"><label>이미지 URL</label><input className="input" value={(b.url as string) ?? ""} onChange={(e) => patch(i, { url: e.target.value })} /></div>
                      <div className="field"><label>대체 텍스트</label><input className="input" value={(b.alt as string) ?? ""} onChange={(e) => patch(i, { alt: e.target.value })} /></div>
                    </>
                  )}
                  {b.type === "TEXT" && (
                    <div className="field"><label>텍스트</label><textarea className="input" rows={2} value={(b.text as string) ?? ""} onChange={(e) => patch(i, { text: e.target.value })} /></div>
                  )}
                  {b.type === "HTML" && (
                    <div className="field"><label>HTML</label><textarea className="input" rows={3} value={(b.html as string) ?? ""} onChange={(e) => patch(i, { html: e.target.value })} /></div>
                  )}
                  {b.type === "FORM" && (
                    <>
                      <div className="field">
                        <label>연결할 폼</label>
                        <select className="input" value={(b.formId as number) ?? ""} onChange={(e) => patch(i, { formId: e.target.value ? Number(e.target.value) : null })}>
                          <option value="">폼 선택…</option>
                          {forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label>노출 방식</label>
                        <select className="input" value={(b.trigger as string) ?? "inline"} onChange={(e) => patch(i, { trigger: e.target.value })}>
                          <option value="inline">인라인(페이지에 바로 표시)</option>
                          <option value="overlay">버튼 → 오버레이(모달)</option>
                        </select>
                      </div>
                      {b.trigger === "overlay" && (
                        <div className="field"><label>버튼 문구</label><input className="input" value={(b.buttonLabel as string) ?? ""} onChange={(e) => patch(i, { buttonLabel: e.target.value })} /></div>
                      )}
                    </>
                  )}
                </div>
              ))}
              <div className="add-block-row">
                <button className="btn btn-ghost btn-sm" onClick={() => add("IMAGE")}>+ 이미지</button>
                <button className="btn btn-ghost btn-sm" onClick={() => add("TEXT")}>+ 텍스트</button>
                <button className="btn btn-ghost btn-sm" onClick={() => add("HTML")}>+ HTML</button>
                <button className="btn btn-ghost btn-sm" onClick={() => add("FORM")}>+ 폼</button>
              </div>
            </div>
          </div>

          {/* 미리보기 (간이) */}
          <div className="preview-panel">
            <div className="card-h">미리보기</div>
            <div className="preview-frame landing-preview">
              {blocks.map((b, i) => {
                if (b.type === "IMAGE") return (b.url as string) ? <img key={i} className="fr-img" src={b.url as string} alt="" /> : <div key={i} className="fr-img-ph">이미지</div>;
                if (b.type === "TEXT") return <p key={i} className="fr-text">{(b.text as string) || ""}</p>;
                if (b.type === "HTML") return <div key={i} className="fr-html" dangerouslySetInnerHTML={{ __html: (b.html as string) || "" }} />;
                if (b.type === "FORM") return (
                  <div key={i} className="landing-form-slot">
                    📋 폼: <strong>{formName(b.formId)}</strong> · {b.trigger === "overlay" ? `버튼 오버레이("${(b.buttonLabel as string) || "신청"}")` : "인라인"}
                  </div>
                );
                return null;
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function blockLabel(t: LandingBlockType): string {
  return { IMAGE: "이미지", TEXT: "텍스트", HTML: "HTML", FORM: "폼" }[t];
}
