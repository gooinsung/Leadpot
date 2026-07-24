import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteLanding, listLandings, type LandingSummary } from "../api/client";
import { useAuth } from "../lib/authContext";
import { publicSiteUrl } from "../lib/site";
import { TopBar } from "../components/TopBar";

export function LandingsListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const sub = user?.subdomain ?? "";
  const [items, setItems] = useState<LandingSummary[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setItems(await listLandings());
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function onDelete(id: number, title: string) {
    if (!window.confirm(`'${title}' 랜딩을 삭제할까요?`)) return;
    await deleteLanding(id);
    load();
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">랜딩페이지</p>
            <h1 className="dash-title">내 랜딩</h1>
            <p className="dash-sub">이미지·텍스트로 페이지를 구성하고 리드폼을 연결해 공개합니다.</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate("/landings/new")}>+ 새 랜딩</button>
        </div>

        {loading ? (
          <p className="dash-sub">불러오는 중…</p>
        ) : items.length === 0 ? (
          <div className="card card-pad empty-state">
            <p>아직 만든 랜딩이 없습니다.</p>
            <button className="btn btn-primary" onClick={() => navigate("/landings/new")}>첫 랜딩 만들기</button>
          </div>
        ) : (
          <div className="card">
            <table>
              <thead>
                <tr><th>제목</th><th>공개 주소</th><th>상태</th><th>수정일</th><th></th></tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr key={l.id} className="row-click" onClick={() => navigate(`/landings/${l.id}/edit`)}>
                    <td>{l.title}</td>
                    <td className="num">{sub ? `${sub}/…/${l.id}` : `…/${l.id}`}</td>
                    <td><span className={`pill ${l.status === "published" ? "g" : ""}`}>{l.status === "published" ? "공개" : "비공개"}</span></td>
                    <td className="num">{new Date(l.updatedAt).toLocaleString("ko-KR")}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {l.status === "published" && sub && (
                        <button className="btn btn-ghost btn-sm" onClick={() => window.open(publicSiteUrl(sub, l.id), "_blank")}>공개 열기</button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => window.open(`/p/${l.slug}`, "_blank")}>미리보기</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/landings/${l.id}/edit`)}>편집</button>
                      <button className="btn btn-ghost btn-sm danger" onClick={() => onDelete(l.id, l.title)}>삭제</button>
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
