import { useCallback, useEffect, useState } from "react";
import { Loading } from "../components/Loading";
import {
  ApiError,
  getAdvertiserReport,
  listAdvertiserForms,
  type AdvertiserForm,
  type AdvertiserReport,
} from "../api/client";
import { AdvertiserTopBar } from "../components/AdvertiserTopBar";

/** 초 → 사람이 읽는 시간(분/시간). null 이면 '—'. */
function fmtDuration(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}초`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}시간 ${mm}분` : `${h}시간`;
}

/**
 * 광고주 처리속도 리포트 `/client/report`.
 * 접수→열람/상태 평균 · 미확인율 · 상태 분포. 인쇄(브라우저 PDF 저장) 지원.
 */
export function AdvertiserReportPage() {
  const [forms, setForms] = useState<AdvertiserForm[]>([]);
  const [formId, setFormId] = useState<number | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState<AdvertiserReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listAdvertiserForms()
      .then((f) => {
        setForms(f);
        if (f.length > 0) setFormId(f[0].formId);
        else setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : "불러오지 못했습니다.");
        setLoading(false);
      });
  }, []);

  const load = useCallback(async () => {
    if (formId == null) return;
    setLoading(true);
    setError("");
    try {
      setReport(await getAdvertiserReport(formId, from || undefined, to || undefined));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "리포트를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [formId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const maxCount = report ? Math.max(1, ...report.statusCounts.map((s) => s.count)) : 1;

  return (
    <div className="app-shell">
      <style>{`@media print {
        .topbar, .report-controls, .no-print { display: none !important; }
        .app-shell, .wrap { padding: 0 !important; margin: 0 !important; }
        .card { break-inside: avoid; }
      }`}</style>
      <AdvertiserTopBar />
      <main className="wrap dashboard client-wrap">
        <div className="dash-head">
          <div>
            <p className="eyebrow">리포트</p>
            <h1 className="dash-title">처리속도 리포트</h1>
            <p className="dash-sub">
              접수된 리드를 <b>얼마나 빨리 확인·처리</b>하는지 보여줍니다. 인쇄를 누르면 PDF로 저장할 수 있습니다.
            </p>
          </div>
          {report && (
            <button className="btn btn-ghost no-print" onClick={() => window.print()}>
              인쇄 / PDF
            </button>
          )}
        </div>

        {/* 리드폼 선택 + 기간 */}
        <div className="report-controls" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
          {forms.length > 1 && (
            <select className="input" style={{ maxWidth: 220 }} value={formId ?? ""} onChange={(e) => setFormId(Number(e.target.value))}>
              {forms.map((f) => (
                <option key={f.formId} value={f.formId}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }} title="접수일시(KST) 범위">
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="시작일" />
            <span className="dash-sub">~</span>
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="종료일" />
          </div>
          {(from || to) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
            >
              기간 초기화
            </button>
          )}
        </div>

        {error && <p className="auth-error">{error}</p>}

        {loading ? (
          <Loading />
        ) : !report ? (
          <div className="card card-pad empty-state">
            <p>열람 권한을 받은 리드폼이 없습니다.</p>
          </div>
        ) : (
          <>
            <p className="dash-sub" style={{ marginTop: -4 }}>
              <b>{report.formName}</b>
              {report.from || report.to ? ` · ${report.from || "처음"} ~ ${report.to || "지금"}` : " · 전체 기간"}
            </p>

            {/* KPI 카드 */}
            <div className="report-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
              <div className="card card-pad">
                <span className="ck-label">총 접수</span>
                <div className="ck-val" style={{ fontSize: 26 }}>{report.total.toLocaleString()}</div>
              </div>
              <div className="card card-pad">
                <span className="ck-label">전환율</span>
                <div className="ck-val" style={{ fontSize: 26 }}>
                  {Math.round(report.conversionRate * 100)}%
                </div>
                <span className="dash-sub" style={{ fontSize: 12 }}>
                  접수 {report.total}건 중 유효 {report.converted}건
                </span>
              </div>
              {/* 열람 지표(미확인율·평균 확인까지)는 광고주에게 보여주지 않는다(V33) —
                  마케터 화면(광고주 관리 > 리포트)에만 남는다. */}
              <div className="card card-pad">
                <span className="ck-label">평균 처리까지</span>
                <div className="ck-val" style={{ fontSize: 22 }}>{fmtDuration(report.avgSecondsToStatus)}</div>
                <span className="dash-sub" style={{ fontSize: 12 }}>접수 → 상태 변경</span>
              </div>
            </div>

            {/* 상태 분포 */}
            <div className="card card-pad">
              <div className="card-h">상태 분포</div>
              <div style={{ display: "grid", gap: 8 }}>
                {report.statusCounts.map((s) => (
                  <div key={s.status} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className={`pill st-${s.status}`} style={{ minWidth: 64, textAlign: "center" }}>{s.label}</span>
                    <div style={{ flex: 1, background: "var(--surface-2, rgba(127,127,127,0.12))", borderRadius: 6, height: 20, overflow: "hidden" }}>
                      <div style={{ width: `${(s.count / maxCount) * 100}%`, height: "100%", background: "var(--accent, #4f46e5)", borderRadius: 6 }} />
                    </div>
                    <span className="num" style={{ minWidth: 40, textAlign: "right" }}>{s.count}</span>
                  </div>
                ))}
              </div>
              <p className="dash-sub" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
                <b>전환율</b>은 접수한 리드 중 상태가 <b>'유효'</b>인 비율입니다.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
