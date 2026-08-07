import { useCallback, useEffect, useState } from "react";
import { Loading } from "../components/Loading";
import { useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  previewEnter,
  previewExit,
  previewLead,
  previewLeads,
  type AdvertiserForm,
  type AdvertiserLead,
  type AdvertiserPreviewLead,
} from "../api/client";
import { TopBar } from "../components/TopBar";
import { Pagination } from "../components/Pagination";

/** 상태 색상 클래스 — 통합 축(V29)의 .ld-* 한 벌(광고주 화면과 동일). */
function statusClass(statusKey: string) {
  return `ld-pill ld-${statusKey.startsWith("C") ? "CUSTOM" : statusKey}`;
}

/**
 * 마케터가 광고주 화면을 <b>읽기 전용</b>으로 미리보는 페이지 `/advertisers/:id/preview`.
 * 쓰기 UI(상태 변경·메모·내보내기)는 아예 렌더링하지 않는다. 진입/이탈은 서버에 IMPERSONATE 로 남는다.
 */
export function AdvertiserPreviewPage() {
  const { id } = useParams();
  const advertiserId = Number(id);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [forms, setForms] = useState<AdvertiserForm[]>([]);
  const [formId, setFormId] = useState<number | null>(null);
  const [leads, setLeads] = useState<AdvertiserLead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detail, setDetail] = useState<AdvertiserPreviewLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 진입 시 로그·데이터, 이탈 시 종료 로그(best-effort).
  useEffect(() => {
    let alive = true;
    previewEnter(advertiserId)
      .then((d) => {
        if (!alive) return;
        setName(d.advertiserCompany || d.advertiserName);
        setForms(d.forms);
        if (d.forms.length > 0) setFormId(d.forms[0].formId);
        else setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof ApiError ? e.message : "미리보기를 열 수 없습니다.");
        setLoading(false);
      });
    return () => {
      alive = false;
      previewExit(advertiserId).catch(() => {});
    };
  }, [advertiserId]);

  const effectiveSize = pageSize === -1 ? 100 : pageSize;

  const load = useCallback(async () => {
    if (formId == null) return;
    setLoading(true);
    setError("");
    try {
      const res = await previewLeads(advertiserId, { formId, page: page - 1, size: effectiveSize });
      setLeads(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "리드를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [advertiserId, formId, page, effectiveSize]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [formId, pageSize]);

  const pages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const currentForm = forms.find((f) => f.formId === formId) ?? null;

  async function openDetail(leadId: number) {
    try {
      setDetail(await previewLead(advertiserId, leadId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "상세를 불러오지 못했습니다.");
    }
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        {/* 읽기 전용 안내 배너 */}
        <div
          className="card card-pad"
          style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
        >
          <div>
            <span className="badge b-normal">읽기 전용 미리보기</span>
            <span className="dash-sub" style={{ marginLeft: 8 }}>
              <b>{name || "광고주"}</b> 가 로그인하면 보게 되는 화면입니다. 여기서는 상태 변경·메모·내보내기를 할 수 없습니다.
            </span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/advertisers")}>
            ← 광고주 목록으로
          </button>
        </div>

        <div className="dash-head">
          <div>
            <p className="eyebrow">광고주 화면</p>
            <h1 className="dash-title">{currentForm?.name ?? "리드"}</h1>
            {currentForm && (
              <p className="dash-sub">
                총 {currentForm.leadCount.toLocaleString()}건
                {currentForm.unseenCount > 0 ? ` · 미확인 ${currentForm.unseenCount}건` : ""}
              </p>
            )}
          </div>
        </div>

        {forms.length === 0 && !loading && !error && (
          <div className="card card-pad empty-state">
            <p>이 광고주에게 부여된 리드폼이 없습니다.</p>
          </div>
        )}

        {forms.length > 1 && (
          <div className="client-forms" style={{ marginBottom: 12 }}>
            {forms.map((f) => (
              <button
                key={f.formId}
                className={f.formId === formId ? "chip on" : "chip"}
                onClick={() => setFormId(f.formId)}
              >
                {f.name}
              </button>
            ))}
          </div>
        )}

        {error && <p className="auth-error">{error}</p>}

        {loading ? (
          <Loading />
        ) : leads.length === 0 && forms.length > 0 ? (
          <div className="card card-pad empty-state">
            <p>아직 접수된 리드가 없습니다.</p>
          </div>
        ) : (
          <>
            <div className="card card-table">
              <table>
                <thead>
                  <tr>
                    <th>접수일시</th>
                    <th>답변</th>
                    <th>상태</th>
                    <th>확인</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id}>
                      <td className="num" style={{ whiteSpace: "nowrap" }}>
                        {new Date(l.createdAt).toLocaleString("ko-KR")}
                      </td>
                      <td>
                        {l.answers.slice(0, 3).map((a) => (
                          <span key={a.label} style={{ marginRight: 10 }}>
                            <span className="dash-sub">{a.label}:</span> {a.value}
                          </span>
                        ))}
                      </td>
                      <td>
                        <span className={`pill ${statusClass(l.statusKey)}`}>{l.statusLabel}</span>
                      </td>
                      <td>{l.advertiserSeenAt ? "확인" : <span className="dash-sub">미확인</span>}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => openDetail(l.id)}>
                          상세
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              total={total}
              page={page}
              pages={pages}
              pageSize={pageSize}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          </>
        )}
      </main>

      {/* 읽기 전용 상세 모달 */}
      {detail && (
        <div className="lead-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setDetail(null)}>
          <div className="card lead-modal" role="dialog" aria-modal="true">
            <div className="lead-modal-head">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>리드 상세 · 읽기 전용</p>
                <h2 style={{ margin: "4px 0 0" }}>
                  <span className={`pill ${statusClass(detail.lead.statusKey)}`}>
                    {detail.lead.statusLabel}
                  </span>
                </h2>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>
                닫기
              </button>
            </div>
            <div className="lead-modal-body">
              <div className="field-label" style={{ marginBottom: 6 }}>답변</div>
              <div className="card card-pad" style={{ marginBottom: 16 }}>
                {detail.lead.answers.map((a) => (
                  <div key={a.label} style={{ display: "flex", gap: 8, padding: "3px 0" }}>
                    <span className="dash-sub" style={{ minWidth: 90 }}>{a.label}</span>
                    <span>{a.value}</span>
                  </div>
                ))}
              </div>
              <div className="field-label" style={{ marginBottom: 6 }}>메모 · 이력</div>
              {detail.notes.length === 0 ? (
                <p className="dash-sub">공유된 메모가 없습니다.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 8 }}>
                  {detail.notes.map((n) => (
                    <li key={n.id} className="card card-pad">
                      <span className="dash-sub" style={{ fontSize: 12 }}>
                        {n.kind === "SYSTEM" ? "이력" : "메모"} · {new Date(n.createdAt).toLocaleString("ko-KR")}
                      </span>
                      <div>{n.body}</div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="dash-sub" style={{ fontSize: 12, marginTop: 12 }}>
                미리보기에서는 열람 기록(확인 표시)이 남지 않으며, 상태·메모를 바꿀 수 없습니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
