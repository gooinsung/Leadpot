import { useEffect, useState } from "react";
import { Loading } from "../components/Loading";
import { useNavigate, useParams } from "react-router-dom";
import { HtmlBlock } from "../components/HtmlBlock";
import {
  ApiError,
  createHtmlComponent,
  getHtmlComponent,
  HTML_COMPONENT_CATEGORIES,
  updateHtmlComponent,
  type HtmlComponentCategory,
} from "../api/client";
import { TopBar } from "../components/TopBar";
import { HtmlImageUploadButton } from "../components/HtmlImageUploadButton";
import { toast } from "../lib/toast";

export function HtmlComponentEditPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<HtmlComponentCategory>("HEADER");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isNew) return;
    getHtmlComponent(Number(id))
      .then((c) => {
        setName(c.name);
        setCategory(c.category);
        setHtml(c.html);
      })
      .catch(() => setError("요소를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  async function onSave() {
    setError("");
    if (!name.trim()) { setError("관리용 이름을 입력해주세요."); return; }
    setSaving(true);
    try {
      const input = { name, category, html };
      if (isNew) await createHtmlComponent(input);
      else await updateHtmlComponent(Number(id), input);
      toast.success(isNew ? "요소를 만들었습니다." : "요소를 저장했습니다.");
      navigate("/html-components");
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
            <p className="eyebrow">{isNew ? "새 HTML 요소" : "HTML 요소 편집"}</p>
            <input
              className="input form-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="관리용 이름 (예: 메인 상단 헤더)"
            />
          </div>
          <div className="edit-actions">
            <button className="btn btn-ghost" onClick={() => navigate("/html-components")}>취소</button>
            <button className="btn btn-primary" onClick={onSave} disabled={saving}>
              {saving ? "저장 중…" : "요소 저장"}
            </button>
          </div>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <div className="edit-grid">
          <div className="card card-pad">
            <div className="card-h">분류</div>
            <select
              className="input"
              style={{ marginBottom: 18 }}
              value={category}
              onChange={(e) => setCategory(e.target.value as HtmlComponentCategory)}
            >
              {HTML_COMPONENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <div className="card-h">HTML 내용</div>
            <div style={{ marginBottom: 8 }}>
              <HtmlImageUploadButton type="component" onInsert={(h) => setHtml((prev) => (prev.trim() ? `${prev}\n${h}` : h))} />
            </div>
            <textarea
              className="input"
              style={{ minHeight: 340, fontFamily: "var(--mono)", fontSize: 13 }}
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              placeholder="<div>…</div> — 랜딩/폼 HTML 블록에 삽입할 HTML을 입력하세요. 고정/플로팅은 style의 position으로 지정할 수 있습니다."
            />
          </div>
          <div className="preview-panel">
            <div className="card-h">미리보기</div>
            <div className="preview-frame">
              <HtmlBlock html={html} debounceMs={600} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
