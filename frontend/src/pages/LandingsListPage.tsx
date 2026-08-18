import { useEffect, useState } from "react";
import { Loading } from "../components/Loading";
import { useNavigate } from "react-router-dom";
import { deleteLanding, listLandings, type LandingSummary } from "../api/client";
import { useAuth } from "../lib/authContext";
import { publicSiteUrl } from "../lib/site";
import { TopBar } from "../components/TopBar";
import { toast } from "../lib/toast";
import { Pagination, usePaging } from "../components/Pagination";
import { runBulk, useSelection } from "../lib/useSelection";
import { AdUrlBuilder } from "../components/AdUrlBuilder";

export function LandingsListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const sub = user?.subdomain ?? "";
  const [items, setItems] = useState<LandingSummary[]>([]);
  // 광고 URL 빌더 대상 랜딩(null = 닫힘). 입력값은 저장하지 않아 서버 상태가 없다.
  const [adUrlTarget, setAdUrlTarget] = useState<LandingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const paging = usePaging(items, 10);

  // 전체선택 + 일괄 삭제 (2026-08-08)
  const sel = useSelection(paging.pageItems.map((l) => l.id));
  const [bulkBusy, setBulkBusy] = useState(false);
  async function onBulkDelete() {
    if (sel.count === 0 || bulkBusy) return;
    if (!window.confirm(`선택한 랜딩 ${sel.count}개를 삭제할까요?`)) return;
    setBulkBusy(true);
    const { ok, fail } = await runBulk([...sel.selected], deleteLanding);
    setBulkBusy(false);
    if (fail > 0) toast.error(`${ok}개 삭제, ${fail}개 실패`);
    else toast.success(`${ok}개 랜딩을 삭제했습니다.`);
    sel.clear();
    load();
  }

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
    try {
      await deleteLanding(id);
      toast.success(`'${title}' 랜딩을 삭제했습니다.`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    }
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
          <Loading />
        ) : items.length === 0 ? (
          <div className="card card-pad empty-state">
            <p>아직 만든 랜딩이 없습니다.</p>
            <button className="btn btn-primary" onClick={() => navigate("/landings/new")}>첫 랜딩 만들기</button>
          </div>
        ) : (
          <>
          {sel.count > 0 && (
            <div className="il-bulk" style={{ paddingBottom: 10 }}>
              <span className="bulk-count">{sel.count}개 선택</span>
              <button className="btn btn-ghost btn-sm danger" disabled={bulkBusy} onClick={onBulkDelete}>선택 삭제</button>
              <button className="btn btn-ghost btn-sm" disabled={bulkBusy} onClick={sel.clear}>해제</button>
            </div>
          )}
          <div className="card card-table">
            <table>
              <thead>
                <tr>
                  <th className="sel-col">
                    <input type="checkbox" checked={sel.allSelected} onChange={sel.toggleAll} aria-label="전체 선택" />
                  </th>
                  <th>제목</th><th>공개 주소</th><th>상태</th><th>수정일</th><th></th>
                </tr>
              </thead>
              <tbody>
                {paging.pageItems.map((l) => (
                  <tr key={l.id} className="row-click" onClick={() => navigate(`/landings/${l.id}/edit`)}>
                    <td className="sel-col" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={sel.selected.has(l.id)} onChange={() => sel.toggle(l.id)} aria-label="선택" />
                    </td>
                    <td>{l.title}</td>
                    <td className="num">{sub ? `${sub}/…/${l.id}` : `…/${l.id}`}</td>
                    <td><span className={`pill ${l.status === "published" ? "g" : ""}`}>{l.status === "published" ? "공개" : "비공개"}</span></td>
                    <td className="num">{new Date(l.updatedAt).toLocaleString("ko-KR")}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {l.status === "published" && sub && (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => window.open(publicSiteUrl(sub, l.id), "_blank")}>공개 열기</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setAdUrlTarget(l)} title="매체·캠페인·광고 이름을 붙인 주소를 만듭니다">광고 URL</button>
                        </>
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
          <Pagination total={paging.total} page={paging.page} pages={paging.pages} pageSize={paging.pageSize} onPage={paging.setPage} onPageSize={paging.setPageSize} unit="개" />
          </>
        )}
      </main>

      {/* 광고 URL 빌더 — 공개 상태 + 서브도메인이 있을 때만 버튼이 뜨므로 sub 은 항상 있다. */}
      {adUrlTarget && (
        <AdUrlBuilder
          baseUrl={publicSiteUrl(sub, adUrlTarget.id)}
          title={adUrlTarget.title}
          onClose={() => setAdUrlTarget(null)}
        />
      )}
    </div>
  );
}
