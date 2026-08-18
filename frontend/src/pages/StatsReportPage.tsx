import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loading } from "../components/Loading";
import { getStats, type StatsOverview } from "../api/client";
import { BarCard, EntityTable, TrendChart, UtmValueTable, bucketize } from "../components/StatsCharts";
import { trackingKeyLabel } from "../lib/tracking";

/**
 * 통계 보고서 화면 — 인쇄/PDF 저장용(브라우저 인쇄 → PDF).
 * 통계 페이지의 [보고서·엑셀] 모달에서 새 탭으로 열린다. 정의는 전부 쿼리스트링으로 받는다:
 * from·to·landingId·formId·utmKey·utmValue·sections(쉼표)·name(보고서 이름).
 * "보고서 정의 = 기간 + 필터 + 섹션" — 나중 '광고주 리포트 발송'도 이 화면을 재사용한다.
 */
export function StatsReportPage() {
  const [sp] = useSearchParams();
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const name = sp.get("name") ?? "통계보고서";
  const sections = useMemo(() => {
    const raw = (sp.get("sections") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    return raw.length > 0 ? raw : ["summary", "trend", "utm", "landing", "form", "device", "status", "referer"];
  }, [sp]);
  const landingId = sp.get("landingId");
  const formId = sp.get("formId");
  const utmKey = sp.get("utmKey");
  const utmValue = sp.get("utmValue");

  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getStats({
      from: from || undefined,
      to: to || undefined,
      landingId: landingId ? Number(landingId) : undefined,
      formId: formId ? Number(formId) : undefined,
      utmKey: utmKey ?? undefined,
      utmValue: utmValue ?? undefined,
    })
      .then(setStats)
      .catch(() => setError(true));
  }, [from, to, landingId, formId, utmKey, utmValue]);

  const has = (k: string) => sections.includes(k);
  const buckets = useMemo(() => (stats ? bucketize(stats.byDay, "day") : []), [stats]);

  if (error) {
    return <div className="wrap" style={{ padding: 40 }}><p>보고서 데이터를 불러오지 못했습니다. 로그인 상태를 확인하세요.</p></div>;
  }
  if (!stats) {
    return <div className="wrap" style={{ padding: 40 }}><Loading /></div>;
  }

  return (
    <div className="report-page">
      {/* 화면에서만 보이는 도구줄 — 인쇄물에는 안 나온다 */}
      <div className="report-toolbar no-print">
        <span className="dash-sub">브라우저 인쇄에서 'PDF로 저장'을 고르면 PDF 파일이 됩니다.</span>
        <button className="btn btn-primary" onClick={() => window.print()}>인쇄 / PDF 저장</button>
      </div>

      <header className="report-head">
        <p className="eyebrow">Leadpot</p>
        <h1>{name}</h1>
        <p className="report-meta">
          기간 {stats.from} ~ {stats.to}
          {utmKey && utmValue && <> · 유입 {trackingKeyLabel(utmKey)} = {utmValue}</>}
          <> · 생성 {new Date().toLocaleString("ko-KR")}</>
        </p>
      </header>

      {has("summary") && (
        <section className="report-section">
          <h2>요약</h2>
          <div className="kpis" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <div className="kpi card"><div className="k-label">순 방문<span className="k-hint">고유</span></div><div className="k-val">{stats.summary.uniqueVisits.toLocaleString("ko-KR")}</div></div>
            <div className="kpi card"><div className="k-label">총 트래픽<span className="k-hint">중복 포함</span></div><div className="k-val">{stats.summary.totalVisits.toLocaleString("ko-KR")}</div></div>
            <div className="kpi card"><div className="k-label">접수(리드)</div><div className="k-val">{stats.summary.leads.toLocaleString("ko-KR")}</div></div>
            <div className="kpi card"><div className="k-label">전환율<span className="k-hint">순 방문 대비</span></div><div className="k-val">{stats.summary.conversionRate}<span style={{ fontSize: 16 }}>%</span></div></div>
          </div>
        </section>
      )}

      {has("trend") && (
        <section className="report-section card card-pad">
          <h2>일별 추이</h2>
          <span className="chart-legend"><i className="lg lg-v" />트래픽 <i className="lg lg-l" />리드</span>
          <TrendChart buckets={buckets} />
        </section>
      )}

      {has("utm") && (
        <section className="report-section">
          <h2>유입별 (광고 URL 파라미터)</h2>
          {["media_from", "campaign_name", "ads_name"].map((key) => {
            const rows = stats.byUtmTables.find((t) => t.key === key)?.rows ?? [];
            return (
              <div className="card card-pad" key={key} style={{ marginBottom: 14 }}>
                <div className="card-h">{trackingKeyLabel(key)}</div>
                <UtmValueTable rows={rows} />
              </div>
            );
          })}
        </section>
      )}

      {has("landing") && (
        <section className="report-section">
          <EntityTable title="랜딩페이지별" rows={stats.byLanding} />
        </section>
      )}

      {has("form") && (
        <section className="report-section">
          <EntityTable title="리드폼별" rows={stats.byForm} />
        </section>
      )}

      {has("device") && (
        <section className="report-section">
          <h2>기기·환경 (접수 리드 기준)</h2>
          <div className="stats-grid">
            <BarCard title="기기" data={stats.byDevice} />
            <BarCard title="OS" data={stats.byOs} />
            <BarCard title="브라우저" data={stats.byBrowser} />
          </div>
        </section>
      )}

      {has("status") && (
        <section className="report-section">
          <h2>리드 상태</h2>
          <BarCard title="상태" data={stats.byStatus} />
        </section>
      )}

      {has("referer") && (
        <section className="report-section">
          <h2>유입 경로</h2>
          <BarCard title="유입 경로" data={stats.byReferer} />
        </section>
      )}

      <footer className="report-foot">Leadpot · {stats.from} ~ {stats.to} · 본 보고서는 리드팟 통계에서 생성되었습니다.</footer>
    </div>
  );
}
