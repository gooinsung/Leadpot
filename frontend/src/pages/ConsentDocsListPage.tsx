import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteConsentDoc, listConsentDocs, type ConsentDocumentSummary } from "../api/client";
import { TopBar } from "../components/TopBar";

export function ConsentDocsListPage() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<ConsentDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setDocs(await listConsentDocs());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onDelete(id: number, title: string) {
    if (!window.confirm(`'${title}' 문서를 삭제할까요?`)) return;
    await deleteConsentDoc(id);
    load();
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">동의 문서</p>
            <h1 className="dash-title">동의·약관 문서</h1>
            <p className="dash-sub">폼의 동의 항목 '보기' 링크로 연결할 문서를 만듭니다.</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate("/consent-docs/new")}>
            + 새 문서
          </button>
        </div>

        {loading ? (
          <p className="dash-sub">불러오는 중…</p>
        ) : docs.length === 0 ? (
          <div className="card card-pad empty-state">
            <p>아직 만든 문서가 없습니다.</p>
            <button className="btn btn-primary" onClick={() => navigate("/consent-docs/new")}>첫 문서 만들기</button>
          </div>
        ) : (
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>제목</th>
                  <th>수정일</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="row-click" onClick={() => navigate(`/consent-docs/${d.id}/edit`)}>
                    <td>{d.title}</td>
                    <td className="num">{new Date(d.updatedAt).toLocaleString("ko-KR")}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-ghost btn-sm" onClick={() => window.open(`/consent/${d.id}`, "_blank")}>
                        보기
                      </button>
                      <button className="btn btn-ghost btn-sm danger" onClick={() => onDelete(d.id, d.title)}>
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
