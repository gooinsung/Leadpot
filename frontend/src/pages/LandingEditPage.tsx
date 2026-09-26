import { useEffect, useState, type CSSProperties } from "react";
import { Loading } from "../components/Loading";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FolderSelect } from "../components/FolderTree";
import { SearchableSelect } from "../components/SearchableSelect";
import { DevicePreviewFrame } from "../components/DevicePreviewFrame";
import { HtmlBlock, resolveStyle, sanitizeHtml } from "@leadpot/public-ui";
import { ConceptColorField } from "../components/ConceptColorField";
import {
  ApiError,
  createLanding,
  getForm,
  getLanding,
  listForms,
  moveLandingFolder,
  updateLanding,
  type FormDetail,
  type FormSummary,
  type LandingBlock,
  type LandingBlockType,
} from "../api/client";
import { TopBar } from "../components/TopBar";
import { HtmlComponentPicker } from "../components/HtmlComponentPicker";
import { DynamicSnippetPicker } from "../components/DynamicSnippetPicker";
import { FormRenderer } from "../components/formRenderers/FormRenderer";
import { ImageUploadField } from "../components/ImageUploadField";
import { HtmlImageUploadButton } from "../components/HtmlImageUploadButton";
import { useUnsavedGuard } from "../lib/useUnsavedGuard";
import { useAuth } from "../lib/authContext";
import { toast } from "../lib/toast";

function newBlock(type: LandingBlockType, forms: FormSummary[]): LandingBlock {
  if (type === "IMAGE") return { type, url: "", alt: "" };
  if (type === "TEXT") return { type, text: "텍스트를 입력하세요" };
  if (type === "HTML") return { type, html: "<p>내용</p>" };
  return { type: "FORM", formId: forms[0]?.id ?? null, trigger: "inline", buttonLabel: "상담 신청하기" };
}

/** 저장된 HTML 요소를 현재 HTML 블록 값에 복사 삽입(스냅샷) — 기존 내용 뒤에 이어붙인다. */
function appendHtml(existing: string, inserted: string): string {
  const base = existing ?? "";
  return base.trim() ? `${base}\n${inserted}` : inserted;
}

/**
 * 블록 여백(위/아래/좌우, px) → 인라인 스타일. 미리보기·공개 랜딩 공용 개념.
 * `full`(전체 폭)이면 좌우 여백·패딩을 0 으로 — LandingView.blockStyle 과 반드시 같게 유지할 것.
 */
function blockStyle(b: LandingBlock): CSSProperties {
  const px = (v: unknown) => (v == null || v === "" ? undefined : `${Number(v)}px`);
  const base: CSSProperties = { marginTop: px(b.mt), marginBottom: px(b.mb) };
  if (b.full) return { ...base, marginLeft: 0, marginRight: 0, paddingLeft: 0, paddingRight: 0, width: "100%" };
  return { ...base, marginLeft: px(b.mx), marginRight: px(b.mx) };
}

export function LandingEditPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  // 새로 만들 때 넣을 폴더. 목록에서 폴더를 고른 채 '새로 만들기'를 누르면 ?folder= 로 넘어온다.
  const [searchParams] = useSearchParams();
  const [newFolderId, setNewFolderId] = useState<number | null>(() => {
    const f = Number(searchParams.get("folder"));
    return Number.isInteger(f) && f > 0 ? f : null;
  });

  const { user } = useAuth();
  const [title, setTitle] = useState("새 랜딩");
  const [status, setStatus] = useState("published");
  const [slug, setSlug] = useState(""); // 공개 주소. 비우면 서버가 자동 생성(신규). 편집 시 현재 slug 로드.
  /**
   * 켜면 HTML 블록의 스크립트·iframe 을 공개 렌더에서 제거한다(V41 `sanitizeHtml`).
   *
   * ⚠️ **편집 UI 는 2026-09-22 에 제거했다(사용자 지시)** — 구글 광고 심사를 통과시키려고 넣은
   * 옵션인데 끝내 승인이 나지 않아 구글 광고를 포기했고, 마케터에게는 켤 이유가 없는 체크박스만
   * 남아 혼란스러웠다. **기능(정화 로직·구글 전용 픽셀 필터)은 그대로 살려둔다** — 이미 켜둔
   * 랜딩이 있을 수 있고, 되살릴 때 체크박스만 다시 붙이면 되게 하려는 것이다.
   * 그래서 서버 값을 그대로 읽어(`setGoogleAdsSafe`) 저장 때 되돌려보내기만 한다(값 보존).
   */
  const [googleAdsSafe, setGoogleAdsSafe] = useState(false);
  const [bgColor, setBgColor] = useState(""); // 랜딩페이지 전체 배경 컬러(V43). 빈 값 = 화이트(기본)
  const [blocks, setBlocks] = useState<LandingBlock[]>([]);
  const [forms, setForms] = useState<FormSummary[]>([]);
  const formOptions = forms.map((f) => ({ value: f.id, label: f.name }));
  const [formDetails, setFormDetails] = useState<Record<number, FormDetail>>({});
  const [device, setDevice] = useState<"mobile" | "pc">("mobile");
  // 미리보기 높이는 화면에 맞춘다 — 기기 iframe 이 이 높이를 채우고 스크롤도 그 안에서만 일어난다.
  const [previewH, setPreviewH] = useState(() => previewHeight());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false); // 저장 안 한 변경 여부
  useUnsavedGuard(dirty);

  useEffect(() => {
    listForms().then(setForms).catch(() => {});
  }, []);

  useEffect(() => {
    const onResize = () => setPreviewH(previewHeight());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
        setSlug(l.slug ?? "");
        setGoogleAdsSafe(!!l.googleAdsSafe);
        setBgColor(l.bgColor ?? "");
        setBlocks(l.content ?? []);
      })
      .catch(() => setError("랜딩을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  // FORM 블록의 기본 formId 를 리드폼 목록 로드 후 채움(신규)
  useEffect(() => {
    if (forms.length === 0) return;
    setBlocks((prev) => prev.map((b) => (b.type === "FORM" && b.formId == null ? { ...b, formId: forms[0].id } : b)));
  }, [forms]);

  // FORM 블록이 참조하는 리드폼 상세를 불러와 미리보기에 실제 리드폼을 렌더
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
    setDirty(true);
    setBlocks((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...p } : b)));
  }
  function add(type: LandingBlockType) {
    setDirty(true);
    setBlocks((prev) => [...prev, newBlock(type, forms)]);
  }
  function remove(i: number) {
    setDirty(true);
    setBlocks((prev) => prev.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    setDirty(true);
    setBlocks((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function cancel() {
    if (dirty && !window.confirm("저장하지 않은 변경사항이 있습니다. 나가시겠어요?")) return;
    navigate("/landings");
  }

  async function onSave() {
    setError("");
    setSaving(true);
    try {
      const payload = { title, content: blocks, status, slug: slug.trim() || undefined, googleAdsSafe, bgColor: bgColor || undefined };
      if (isNew) {
        const created = await createLanding(payload);
        if (newFolderId != null) {
          await moveLandingFolder(created.id, newFolderId).catch(() =>
            toast.error("랜딩은 만들었지만 폴더에 넣지 못했습니다. 목록에서 끌어다 옮겨주세요."),
          );
        }
      } else await updateLanding(Number(id), payload);
      setDirty(false);
      toast.success(isNew ? "랜딩을 만들었습니다." : "랜딩을 저장했습니다.");
      navigate("/landings");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading full />;

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap form-edit">
        <div className="dash-head">
          <div>
            <p className="eyebrow">{isNew ? "새 랜딩" : "랜딩 편집"}</p>
            <input className="input form-name" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
          </div>
          <div className="edit-actions">
            {isNew && <FolderSelect kind="LANDING" value={newFolderId} onChange={setNewFolderId} />}
            <select className="input" style={{ width: 110 }} value={status} onChange={(e) => { setStatus(e.target.value); setDirty(true); }}>
              <option value="published">공개</option>
              <option value="draft">비공개</option>
            </select>
            <button className="btn btn-ghost" onClick={cancel}>취소</button>
            <button className="btn btn-primary" onClick={onSave} disabled={saving}>{saving ? "저장 중…" : "랜딩 저장"}</button>
          </div>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="field" style={{ marginBottom: 0, maxWidth: 480 }}>
            <label>공개 주소 (slug){isNew ? " · 비우면 자동 생성" : ""}</label>
            <input
              className="input"
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setDirty(true); }}
              placeholder="예: summer-event 또는 여름이벤트 (한글·소문자·숫자·하이픈)"
              spellCheck={false}
              autoCapitalize="none"
            />
            <span className="field-optional" style={{ marginTop: 6, fontSize: 12, overflowWrap: "anywhere" }}>
              공개 URL: <code>{user?.subdomain ?? "내서브도메인"}.lead-pot.com/{slug.trim() || "자동생성"}</code>
              {" "}(랜딩번호로도 접속 가능)
            </span>
          </div>
          <div style={{ marginTop: 12 }}>
            <ConceptColorField
              label="랜딩페이지 배경 컬러 (화이트·블랙·블루)"
              value={bgColor}
              onChange={(v) => { setBgColor(v); setDirty(true); }}
            />
          </div>
        </div>

        <div className="edit-grid">
          {/* 편집 */}
          <div className="edit-panel">
            <div className="card card-pad">
              <div className="card-h">페이지 블록</div>
              {blocks.map((b, i) => (
                <div className="block-editor" key={i}>
                  <div className="block-editor-head">
                    <span className={`pill ${b.type === "FORM" ? "g" : ""}`}>{blockLabel(b.type)}</span>
                    {/* 블록 이름 — 편집 화면에서 블록을 구분하기 위한 라벨. 공개 페이지에는 나오지 않는다. */}
                    <input
                      className="input block-name-input"
                      value={b.name ?? ""}
                      onChange={(e) => patch(i, { name: e.target.value || undefined })}
                      placeholder={`${blockLabel(b.type)} ${i + 1} · 이름 지정 (예: 헤더 이미지)`}
                      title="편집 화면에서만 보이는 블록 이름입니다. 공개 페이지에는 노출되지 않습니다."
                    />
                    <div className="block-editor-ctrl">
                      <button className="btn btn-ghost btn-sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => move(i, 1)} disabled={i === blocks.length - 1}>↓</button>
                      <button className="btn btn-ghost btn-sm danger" onClick={() => remove(i)}>삭제</button>
                    </div>
                  </div>
                  {b.type === "IMAGE" && (
                    <ImageUploadField url={(b.url as string) ?? ""} alt={(b.alt as string) ?? ""} onChange={(p) => patch(i, p)} />
                  )}
                  {b.type === "TEXT" && (
                    <div className="field"><label>텍스트</label><textarea className="input" rows={2} value={(b.text as string) ?? ""} onChange={(e) => patch(i, { text: e.target.value })} /></div>
                  )}
                  {b.type === "HTML" && (
                    <div className="field">
                      <label>HTML</label>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <HtmlComponentPicker onInsert={(h) => patch(i, { html: appendHtml((b.html as string) ?? "", h) })} />
                        <DynamicSnippetPicker onInsert={(h) => patch(i, { html: appendHtml((b.html as string) ?? "", h) })} />
                        <HtmlImageUploadButton type="landing" onInsert={(h) => patch(i, { html: appendHtml((b.html as string) ?? "", h) })} />
                      </div>
                      <textarea className="input" rows={3} value={(b.html as string) ?? ""} onChange={(e) => patch(i, { html: e.target.value })} />
                    </div>
                  )}
                  {b.type === "FORM" && (
                    <>
                      <div className="field">
                        <label>연결할 리드폼</label>
                        <SearchableSelect
                          value={(b.formId as number) ?? null}
                          options={formOptions}
                          onChange={(v) => patch(i, { formId: v })}
                          placeholder="리드폼 선택… (클릭해서 이름으로 검색)"
                        />
                      </div>
                      <div className="field">
                        <label>노출 방식</label>
                        <select className="input" value={(b.trigger as string) ?? "inline"} onChange={(e) => patch(i, { trigger: e.target.value })}>
                          <option value="inline">인라인(페이지에 바로 표시)</option>
                          <option value="overlay">버튼 → 오버레이(모달)</option>
                          <option value="fullscreen">버튼 → 풀스크린 스텝 진행</option>
                        </select>
                      </div>
                      {(b.trigger === "overlay" || b.trigger === "fullscreen") && (
                        <>
                          <div className="field"><label>버튼 문구</label><input className="input" value={(b.buttonLabel as string) ?? ""} onChange={(e) => patch(i, { buttonLabel: e.target.value })} /></div>
                          <div className="field">
                            <label>버튼 아래 설명(선택)</label>
                            <input className="input" placeholder="예: 상담 신청 후 24시간 내 연락드립니다" value={(b.buttonDescription as string) ?? ""} onChange={(e) => patch(i, { buttonDescription: e.target.value })} />
                          </div>
                        </>
                      )}
                    </>
                  )}
                  <div className="block-margins">
                    <span className="mini-label">여백(px) — 플로팅 헤더 대비 상단 여백 등</span>
                    <div className="block-margin-item"><span>위</span><input className="input" type="number" min={0} value={(b.mt as number) ?? ""} onChange={(e) => patch(i, { mt: e.target.value ? Number(e.target.value) : undefined })} /></div>
                    <div className="block-margin-item"><span>아래</span><input className="input" type="number" min={0} value={(b.mb as number) ?? ""} onChange={(e) => patch(i, { mb: e.target.value ? Number(e.target.value) : undefined })} /></div>
                    <div className="block-margin-item"><span>좌우</span><input className="input" type="number" min={0} value={(b.mx as number) ?? ""} onChange={(e) => patch(i, { mx: e.target.value ? Number(e.target.value) : undefined })} disabled={!!b.full} /></div>
                  </div>
                  {b.type !== "FORM" && (
                    <label className="block-full-toggle">
                      <input type="checkbox" checked={!!b.full} onChange={(e) => patch(i, { full: e.target.checked || undefined })} />
                      <span>좌우 여백 없이 화면 전체 폭 사용</span>
                    </label>
                  )}
                </div>
              ))}
              <div className="add-block-row">
                <button className="btn btn-ghost btn-sm" onClick={() => add("IMAGE")}>+ 이미지</button>
                <button className="btn btn-ghost btn-sm" onClick={() => add("TEXT")}>+ 텍스트</button>
                <button className="btn btn-ghost btn-sm" onClick={() => add("HTML")}>+ HTML</button>
                <button className="btn btn-ghost btn-sm" onClick={() => add("FORM")}>+ 리드폼</button>
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
            {/* iframe 이 곧 '기기' — 자기 뷰포트를 가지므로 미디어쿼리가 실제 폰과 같게 평가된다.
                예전처럼 박스만 좁히면 @media 가 브라우저 창 폭을 봐서 미리보기만 어긋났다. */}
            <div className={`lp-preview-stage ${device}`}>
              <DevicePreviewFrame width={device === "mobile" ? 375 : 1280} fitHeight={previewH}>
              <div className="lp-preview-device in-frame" style={bgColor ? { background: bgColor } : undefined}>
                {blocks.length === 0 && <p className="dash-sub" style={{ padding: 24, textAlign: "center" }}>블록을 추가하면 미리보기가 표시됩니다.</p>}
                {blocks.map((b, i) => {
                  const ms = blockStyle(b);
                  if (b.type === "IMAGE")
                    return (b.url as string)
                      ? <img key={i} className="landing-img" src={b.url as string} alt="" style={ms} />
                      : <div key={i} className="fr-img-ph" style={{ margin: 16, ...ms }}>이미지</div>;
                  if (b.type === "TEXT") return <p key={i} className="landing-text" style={ms}>{(b.text as string) || ""}</p>;
                  // 편집 중엔 타이핑마다 스크립트가 다시 돌지 않게 늦춘다(타이머 누적 방지).
                  // 구글 광고용 옵션이 켜져 있으면 미리보기도 실제 공개 렌더처럼 스크립트를 제거해서 보여준다.
                  if (b.type === "HTML") {
                    const raw = (b.html as string) || "";
                    const html = googleAdsSafe ? sanitizeHtml(raw) : raw;
                    return <HtmlBlock key={i} className="landing-html" style={ms} html={html} debounceMs={600} />;
                  }
                  if (b.type === "FORM") {
                    const fid = b.formId as number | null;
                    const detail = fid != null ? formDetails[fid] : undefined;
                    if (b.trigger === "overlay" || b.trigger === "fullscreen") {
                      const isFullscreen = b.trigger === "fullscreen";
                      // 버튼 색은 연결된 리드폼의 버튼 색을 따라간다(실제 공개 렌더 LandingView와 동일한 규칙).
                      const btnStyle = detail ? resolveStyle(detail) : undefined;
                      return (
                        <div key={i} style={{ padding: "8px 16px 16px", ...ms }}>
                          <button
                            className="btn"
                            style={{ width: "100%", minHeight: 48, background: btnStyle?.buttonColor ?? "#12b886", color: btnStyle?.buttonText ?? "#fff" }}
                            disabled
                          >
                            {(b.buttonLabel as string) || "신청하기"}
                          </button>
                          {(b.buttonDescription as string) && (
                            <p className="dash-sub" style={{ textAlign: "center", marginTop: 6 }}>{b.buttonDescription as string}</p>
                          )}
                          <p className="dash-sub" style={{ textAlign: "center", marginTop: 6, fontSize: 12 }}>
                            {isFullscreen ? "버튼 클릭 시 화면 전체를 채우는 스텝형으로 리드폼 표시" : "버튼 클릭 시 오버레이로 리드폼 표시"}
                          </p>
                        </div>
                      );
                    }
                    return <div key={i} className="landing-form-card" style={ms}>{detail ? <FormRenderer form={detail} /> : <Loading label="리드폼 미리보기 불러오는 중…" />}</div>;
                  }
                  return null;
                })}
              </div>
              </DevicePreviewFrame>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/** 미리보기 기기 높이 — 창 높이에 맞춰 스테이지가 화면을 넘지 않게 한다. */
function previewHeight(): number {
  return Math.max(420, Math.round(window.innerHeight * 0.72));
}

function blockLabel(t: LandingBlockType): string {
  return { IMAGE: "이미지", TEXT: "텍스트", HTML: "HTML", FORM: "리드폼" }[t];
}
