import { useCallback, useEffect, useState } from "react";
import {
  ADVERTISER_LEAD_STATUSES,
  ApiError,
  getAdvertiserDashboard,
  listAdvertiserForms,
  listAdvertiserLeads,
  type AdvertiserDashboard,
  type AdvertiserForm,
  type AdvertiserLead,
} from "../api/client";
import { AdvertiserTopBar } from "../components/AdvertiserTopBar";
import { AdvertiserLeadDetail } from "../components/AdvertiserLeadDetail";

const PAGE_SIZE = 20;

/** 답변에서 대표 표시값(이름처럼 보이는 첫 텍스트)과 연락처를 뽑는다. */
function summarize(lead: AdvertiserLead) {
  const phone = lead.answers.find((a) => /연락처|전화|휴대|폰|phone|tel/i.test(a.label ?? ""))?.value;
  const first = lead.answers.find((a) => (a.value ?? "").trim() !== "");
  return { phone: phone?.replace(/[^0-9+]/g, "") || null, title: first?.value || "(내용 없음)" };
}

/**
 * 광고주 리드 목록 (모바일 퍼스트).
 * 광고주는 텔레그램 알림 → 링크 → 목록 → 상세 → 전화 순으로 휴대폰에서 쓴다.
 */
export function AdvertiserLeadsPage() {
  const [forms, setForms] = useState<AdvertiserForm[]>([]);
  const [formId, setFormId] = useState<number | null>(null);
  const [dash, setDash] = useState<AdvertiserDashboard | null>(null);

  const [leads, setLeads] = useState<AdvertiserLead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [unseenOnly, setUnseenOnly] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [f, d] = await Promise.all([listAdvertiserForms(), getAdvertiserDashboard()]);
        setForms(f);
        setDash(d);
        if (f.length > 0) setFormId(f[0].formId);
        else setLoading(false);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "불러오지 못했습니다.");
        setLoading(false);
      }
    })();
  }, []);

  const load = useCallback(async () => {
    if (formId == null) return;
    setLoading(true);
    setError("");
    try {
      const res = await listAdvertiserLeads({ formId, status: status || undefined, q: q || undefined, page, size: PAGE_SIZE });
      setLeads(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [formId, status, q, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function refreshCounts() {
    try {
      const [f, d] = await Promise.all([listAdvertiserForms(), getAdvertiserDashboard()]);
      setForms(f);
      setDash(d);
    } catch {
      // 카운트 갱신 실패는 화면을 막지 않는다
    }
  }

  const currentForm = forms.find((f) => f.formId === formId) ?? null;
  const shown = unseenOnly ? leads.filter((l) => !l.advertiserSeenAt) : leads;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="app-shell">
      <AdvertiserTopBar />
      <main className="wrap client-wrap">
        {dash && dash.unseenLeads > 0 && (
          <button
            type="button"
            className="unseen-banner"
            onClick={() => {
              setUnseenOnly(true);
              setStatus("");
            }}
          >
            <span className="unseen-dot" />
            확인하지 않은 리드 <strong>{dash.unseenLeads}건</strong>이 있습니다
            <span className="unseen-go">보기 →</span>
          </button>
        )}

        <div className="client-head">
          <div>
            <p className="eyebrow">접수 내역</p>
            <h1 className="client-title">{currentForm?.name ?? "리드"}</h1>
          </div>
          {dash && (
            <div className="client-kpis">
              <div>
                <span className="ck-label">오늘</span>
                <span className="ck-val">{dash.todayLeads}</span>
              </div>
              <div>
                <span className="ck-label">전체</span>
                <span className="ck-val">{dash.totalLeads}</span>
              </div>
            </div>
          )}
        </div>

        {forms.length === 0 && !loading && !error && (
          <div className="card card-pad empty-state">
            <p>아직 열람 권한을 받은 리드폼이 없습니다.</p>
            <p className="dash-sub">담당 마케터에게 문의해주세요.</p>
          </div>
        )}

        {forms.length > 1 && (
          <div className="client-forms">
            {forms.map((f) => (
              <button
                key={f.formId}
                className={f.formId === formId ? "chip on" : "chip"}
                onClick={() => {
                  setFormId(f.formId);
                  setPage(0);
                  setUnseenOnly(false);
                }}
              >
                {f.name}
                {f.unseenCount > 0 && <span className="chip-badge">{f.unseenCount}</span>}
              </button>
            ))}
          </div>
        )}

        {forms.length > 0 && (
          <div className="client-filters">
            <input
              className="input"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="이름·연락처 검색"
            />
            <select
              className="input"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="">전체 상태</option>
              {ADVERTISER_LEAD_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            {unseenOnly && (
              <button className="btn btn-ghost btn-sm" onClick={() => setUnseenOnly(false)}>
                미확인만 보기 해제
              </button>
            )}
          </div>
        )}

        {error && <p className="auth-error">{error}</p>}

        {loading ? (
          <p className="dash-sub">불러오는 중…</p>
        ) : shown.length === 0 && forms.length > 0 ? (
          <div className="card card-pad empty-state">
            <p>조건에 맞는 리드가 없습니다.</p>
          </div>
        ) : (
          <div className="cl-cards">
            {shown.map((lead) => {
              const { phone, title } = summarize(lead);
              const unseen = !lead.advertiserSeenAt;
              return (
                <div key={lead.id} className={unseen ? "cl-card is-new" : "cl-card"}>
                  <button className="cl-card-main" onClick={() => setOpenId(lead.id)}>
                    <div className="lc-top">
                      <span className="lc-title">{title}</span>
                      {unseen && <span className="pill w">NEW</span>}
                    </div>
                    <div className="lc-meta">
                      <span className={`lc-status s-${lead.advertiserStatus}`}>{lead.advertiserStatusLabel}</span>
                      <span className="lc-date">{new Date(lead.createdAt).toLocaleString("ko-KR")}</span>
                    </div>
                  </button>
                  {phone && (
                    <a className="cl-card-call" href={`tel:${phone}`} aria-label="전화 걸기">
                      📞
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {forms.length > 0 && total > PAGE_SIZE && !unseenOnly && (
          <div className="client-paging">
            <button className="btn btn-ghost btn-sm" disabled={page <= 0} onClick={() => setPage(page - 1)}>
              ← 이전
            </button>
            <span className="dash-sub">
              {page + 1} / {pages} (총 {total}건)
            </span>
            <button className="btn btn-ghost btn-sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
              다음 →
            </button>
          </div>
        )}
      </main>

      {openId != null && (
        <AdvertiserLeadDetail
          leadId={openId}
          canStatus={currentForm?.canStatus ?? false}
          canMemo={currentForm?.canMemo ?? false}
          onClose={() => setOpenId(null)}
          onChanged={(updated) => {
            setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
            refreshCounts();
          }}
        />
      )}
    </div>
  );
}
