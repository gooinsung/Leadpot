import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, createConsentDoc, getConsentDoc, updateConsentDoc } from "../api/client";
import { TopBar } from "../components/TopBar";
import { toast } from "../lib/toast";

export function ConsentDocEditPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [title, setTitle] = useState("개인정보 수집 및 이용 동의");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isNew) return;
    getConsentDoc(Number(id))
      .then((d) => {
        setName(d.name);
        setTitle(d.title);
        setContent(d.content);
      })
      .catch(() => setError("문서를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  async function onSave() {
    setError("");
    if (!name.trim()) { setError("관리용 이름을 입력해주세요."); return; }
    if (!title.trim()) { setError("공개 제목을 입력해주세요."); return; }
    setSaving(true);
    try {
      if (isNew) await createConsentDoc({ name, title, content });
      else await updateConsentDoc(Number(id), { name, title, content });
      toast.success(isNew ? "동의 문서를 만들었습니다." : "동의 문서를 저장했습니다.");
      navigate("/consent-docs");
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
            <p className="eyebrow">{isNew ? "새 동의 문서" : "동의 문서 편집"}</p>
            <input
              className="input form-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="관리용 이름 (예: A상품 이용 동의)"
            />
          </div>
          <div className="edit-actions">
            <button className="btn btn-ghost" onClick={() => navigate("/consent-docs")}>취소</button>
            <button className="btn btn-primary" onClick={onSave} disabled={saving}>
              {saving ? "저장 중…" : "문서 저장"}
            </button>
          </div>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <div className="edit-grid">
          <div className="card card-pad">
            <div className="card-h">공개 제목 (방문자에게 노출)</div>
            <input
              className="input"
              style={{ marginBottom: 18 }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 개인정보 수집 및 이용 동의"
            />
            <div className="card-h">내용 (HTML 사용 가능)</div>
            <textarea
              className="input"
              style={{ minHeight: 340, fontFamily: "var(--mono)", fontSize: 13 }}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="동의 내용을 입력하세요. HTML 태그를 사용할 수 있습니다."
            />
          </div>
          <div className="preview-panel">
            <div className="card-h">미리보기</div>
            <div className="preview-frame">
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>{title}</h2>
              <div className="consent-doc-body" dangerouslySetInnerHTML={{ __html: content }} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
