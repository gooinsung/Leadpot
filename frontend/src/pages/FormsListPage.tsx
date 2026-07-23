import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteForm, listForms, type FormSummary } from "../api/client";
import { TopBar } from "../components/TopBar";

export function FormsListPage() {
  const navigate = useNavigate();
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setForms(await listForms());
    } catch {
      setError("폼 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onDelete(id: number, name: string) {
    if (!window.confirm(`'${name}' 폼을 삭제할까요?`)) return;
    await deleteForm(id);
    load();
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">폼 관리</p>
            <h1 className="dash-title">내 폼</h1>
            <p className="dash-sub">랜딩과 별개로 폼을 만들어 여러 곳에서 재사용합니다.</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate("/forms/new")}>
            + 새 폼 만들기
          </button>
        </div>

        {loading ? (
          <p className="dash-sub">불러오는 중…</p>
        ) : error ? (
          <p className="auth-error">{error}</p>
        ) : forms.length === 0 ? (
          <div className="card card-pad empty-state">
            <p>아직 만든 폼이 없습니다.</p>
            <button className="btn btn-primary" onClick={() => navigate("/forms/new")}>
              첫 폼 만들기
            </button>
          </div>
        ) : (
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>유형</th>
                  <th>항목 수</th>
                  <th>수정일</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {forms.map((f) => (
                  <tr key={f.id} className="row-click" onClick={() => navigate(`/forms/${f.id}/edit`)}>
                    <td>{f.name}</td>
                    <td>
                      <span className="pill i">{f.formType === "BASIC" ? "기본형" : "스텝형"}</span>
                    </td>
                    <td className="num">{f.blockCount}</td>
                    <td className="num">{new Date(f.updatedAt).toLocaleString("ko-KR")}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/forms/${f.id}/leads`)}>
                        리드
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/forms/${f.id}/edit`)}>
                        편집
                      </button>
                      <button className="btn btn-ghost btn-sm danger" onClick={() => onDelete(f.id, f.name)}>
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
