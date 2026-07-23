import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  createLanding,
  getForm,
  getLanding,
  listForms,
  updateLanding,
  type FormDetail,
  type FormSummary,
  type LandingBlock,
  type LandingBlockType,
} from "../api/client";
import { TopBar } from "../components/TopBar";
import { FormRenderer } from "../components/formRenderers/FormRenderer";

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
  const [formDetails, setFormDetails] = useState<Record<number, FormDetail>>({});
  const [device, setDevice] = useState<"mobile" | "pc">("mobile");
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

  // FORM 블록이 참조하는 폼 상세를 불러와 미리보기에 실제 폼을 렌더
  useEffect(() => {
    const ids = Array.from(new Set(
      blocks.filter((b) => b.type === "FORM" && b.formId != null).map((b) => Number(b.formId)),
    ));
    ids.forEach((fid) => {
      if (formDetails[fid]) return;
      getForm(fid).then((d) => setFormDetails((prev) => ({ ...prev, [fid]: d }))).catch(() => {});
    });
  }, [blocks, formDetails]);

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

          {/* 미리보기 — PC/모바일 전환 + 실제 렌더 */}
          <div className="preview-panel">
            <div className="lp-preview-head">
              <span className="card-h" style={{ margin: 0 }}>미리보기</span>
              <div className="type-seg lp-device-seg">
                <button className={device === "mobile" ? "on" : ""} onClick={() => setDevice("mobile")}>📱 모바일</button>
                <button className={device === "pc" ? "on" : ""} onClick={() => setDevice("pc")}>🖥️ PC</button>
              </div>
            </div>
            <div className={`lp-preview-stage ${device}`}>
              <div className="lp-preview-device">
                {blocks.length === 0 && <p className="dash-sub" style={{ padding: 24, textAlign: "center" }}>블록을 추가하면 미리보기가 표시됩니다.</p>}
                {blocks.map((b, i) => {
                  if (b.type === "IMAGE")
                    return (b.url as string)
                      ? <img key={i} className="landing-img" src={b.url as string} alt="" />
                      : <div key={i} className="fr-img-ph" style={{ margin: 16 }}>이미지</div>;
                  if (b.type === "TEXT") return <p key={i} className="landing-text">{(b.text as string) || ""}</p>;
                  if (b.type === "HTML") return <div key={i} className="landing-html" dangerouslySetInnerHTML={{ __html: (b.html as string) || "" }} />;
                  if (b.type === "FORM") {
                    const fid = b.formId as number | null;
                    const detail = fid != null ? formDetails[fid] : undefined;
                    if (b.trigger === "overlay") {
                      return (
                        <div key={i} style={{ padding: "8px 16px 16px" }}>
                          <button className="btn btn-green" style={{ width: "100%", minHeight: 48 }} disabled>{(b.buttonLabel as string) || "신청하기"}</button>
                          <p className="dash-sub" style={{ textAlign: "center", marginTop: 6, fontSize: 12 }}>버튼 클릭 시 오버레이로 폼 표시</p>
                        </div>
                      );
                    }
                    return (
                      <div key={i} className="landing-form-card">
                        {detail ? <FormRenderer form={detail} /> : <p className="dash-sub">폼 미리보기 불러오는 중…</p>}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
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
