import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteHtmlComponent,
  HTML_COMPONENT_CATEGORIES,
  listHtmlComponents,
  type HtmlComponentSummary,
} from "../api/client";
import { TopBar } from "../components/TopBar";
import { Pagination, usePaging } from "../components/Pagination";

const catLabel = (v: string) => HTML_COMPONENT_CATEGORIES.find((c) => c.value === v)?.label ?? v;

export function HtmlComponentsListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<HtmlComponentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const paging = usePaging(items, 10);

  async function load() {
    setLoading(true);
    try {
      setItems(await listHtmlComponents());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onDelete(id: number, name: string) {
    if (!window.confirm(`'${name}' 요소를 삭제할까요? 이미 삽입된 곳은 그대로 유지됩니다.`)) return;
    await deleteHtmlComponent(id);
    load();
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">HTML 요소 라이브러리</p>
            <h1 className="dash-title">재사용 HTML 요소</h1>
            <p className="dash-sub">헤더·푸터·CTA 같은 HTML 조각을 저장해두고, 랜딩·리드폼의 HTML 블록에 꺼내 삽입합니다.</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate("/html-components/new")}>
            + 새 요소
          </button>
        </div>

        {loading ? (
          <p className="dash-sub">불러오는 중…</p>
        ) : items.length === 0 ? (
          <div className="card card-pad empty-state">
            <p>아직 만든 요소가 없습니다.</p>
            <button className="btn btn-primary" onClick={() => navigate("/html-components/new")}>첫 요소 만들기</button>
          </div>
        ) : (
          <>
          <div className="card card-table">
            <table>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>분류</th>
                  <th>수정일</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paging.pageItems.map((c) => (
                  <tr key={c.id} className="row-click" onClick={() => navigate(`/html-components/${c.id}/edit`)}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>
                      <span className="pill i">{catLabel(c.category)}</span>
                    </td>
                    <td className="num">{new Date(c.updatedAt).toLocaleString("ko-KR")}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/html-components/${c.id}/edit`)}>
                        편집
                      </button>
                      <button className="btn btn-ghost btn-sm danger" onClick={() => onDelete(c.id, c.name)}>
                        삭제
                      </button>
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
    </div>
  );
}
