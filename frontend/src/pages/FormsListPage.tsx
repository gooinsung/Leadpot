import { useEffect, useState } from "react";
import { Loading } from "../components/Loading";
import { useNavigate } from "react-router-dom";
import { deleteForm, listForms, type FormSummary } from "../api/client";
import { TopBar } from "../components/TopBar";
import { toast } from "../lib/toast";
import { Pagination, usePaging } from "../components/Pagination";

export function FormsListPage() {
  const navigate = useNavigate();
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const paging = usePaging(forms, 10);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setForms(await listForms());
    } catch {
      setError("리드폼 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onDelete(id: number, name: string) {
    if (!window.confirm(`'${name}' 리드폼을 삭제할까요?`)) return;
    try {
      await deleteForm(id);
      toast.success(`'${name}' 리드폼을 삭제했습니다.`);
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
            <p className="eyebrow">리드폼 관리</p>
            <h1 className="dash-title">내 리드폼</h1>
            <p className="dash-sub">랜딩과 별개로 리드폼을 만들어 여러 곳에서 재사용합니다.</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate("/forms/new")}>
            + 새 리드폼 만들기
          </button>
        </div>

        {loading ? (
          <Loading />
        ) : error ? (
          <p className="auth-error">{error}</p>
        ) : forms.length === 0 ? (
          <div className="card card-pad empty-state">
            <p>아직 만든 리드폼이 없습니다.</p>
            <button className="btn btn-primary" onClick={() => navigate("/forms/new")}>
              첫 리드폼 만들기
            </button>
          </div>
        ) : (
          <>
          <div className="card card-table">
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
                {paging.pageItems.map((f) => (
                  <tr key={f.id} className="row-click" onClick={() => navigate(`/forms/${f.id}/edit`)}>
                    <td>{f.name}</td>
                    <td>
                      {/* 리디자인 §6: 기본형=인디고 soft · 스텝형=그린 soft */}
                      <span className={f.formType === "BASIC" ? "pill i" : "pill gr"}>
                        {f.formType === "BASIC" ? "기본형" : "스텝형"}
                      </span>
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
          <Pagination total={paging.total} page={paging.page} pages={paging.pages} pageSize={paging.pageSize} onPage={paging.setPage} onPageSize={paging.setPageSize} unit="개" />
          </>
        )}
      </main>
    </div>
  );
}
