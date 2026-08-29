import { useEffect, useMemo, useState } from "react";
import { Loading } from "../components/Loading";
import {
  downloadStatsReport,
  getStats,
  listForms,
  listLandings,
  type FormSummary,
  type LandingSummary,
  type StatFunnel,
  type StatJourney,
  type StatsOverview,
} from "../api/client";
import { TopBar } from "../components/TopBar";
import { BarCard, EntityTable, TrendChart, UtmValueTable, bucketize, type Grain } from "../components/StatsCharts";
import { trackingKeyLabel } from "../lib/tracking";
import { toast } from "../lib/toast";

type Preset = "today" | "7d" | "30d" | "custom";

/** 유입별 비교 표의 축(자체 파라미터 3종) — 백엔드 byUtmTables 와 같은 키. */
const UTM_TABLE_KEYS = ["media_from", "campaign_name", "ads_name"] as const;

/**
 * 보고서 섹션 — 키는 백엔드 StatsExportService·보고서 화면(StatsReportPage)과 계약이다.
 * 나중 '광고주 리포트 발송'도 같은 정의(기간+필터+섹션)를 재사용한다.
 */
const REPORT_SECTIONS: { key: string; label: string }[] = [
  { key: "summary", label: "요약(방문·리드·전환율)" },
  { key: "trend", label: "일별 추이" },
  { key: "utm", label: "유입별(매체·캠페인·광고)" },
  { key: "landing", label: "랜딩페이지별" },
  { key: "form", label: "리드폼별" },
  { key: "device", label: "기기·환경" },
  { key: "status", label: "리드 상태" },
  { key: "referer", label: "유입 경로" },
];

/** YYYY-MM-DD (로컬 기준). */
function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
}
/** 이번 달 1일. */
function monthStart(): string {
  const d = new Date();
  return ymd(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** 보고서 기간 단위 → 기간·이름. current 는 화면 필터 기간 그대로. */
type ReportUnit = "current" | "daily" | "weekly" | "monthly";
function reportRange(unit: ReportUnit, current: { from: string; to: string }): { from: string; to: string; name: string } {
  const today = ymd(new Date());
  if (unit === "daily") return { from: today, to: today, name: "일간보고서" };
  if (unit === "weekly") return { from: daysAgo(6), to: today, name: "주간보고서" };
  if (unit === "monthly") return { from: monthStart(), to: today, name: "월간보고서" };
  return { from: current.from, to: current.to, name: "통계보고서" };
}

export function StatsPage() {
  const [view, setView] = useState<"overview" | "journey">("overview");
  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(ymd(new Date()));
  const [target, setTarget] = useState("all"); // all | landing:{id} | form:{id}
  const [grain, setGrain] = useState<Grain>("day");
  // 유입 필터 — 유입별 표 행 클릭으로 걸린다. 걸리면 페이지 전체가 그 유입만으로 재계산.
  const [utmSel, setUtmSel] = useState<{ key: string; value: string } | null>(null);
  const [utmTab, setUtmTab] = useState<(typeof UTM_TABLE_KEYS)[number]>("media_from");

  const [landings, setLandings] = useState<LandingSummary[]>([]);
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  // 보고서(엑셀·인쇄 화면) 모달
  const [reportOpen, setReportOpen] = useState(false);
  const [reportUnit, setReportUnit] = useState<ReportUnit>("current");
  const [reportSections, setReportSections] = useState<string[]>(REPORT_SECTIONS.map((s) => s.key));
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    listLandings().then(setLandings).catch(() => {});
    listForms().then(setForms).catch(() => {});
  }, []);

  // preset → from/to 반영(custom 은 사용자가 직접)
  useEffect(() => {
    if (preset === "today") { setFrom(daysAgo(0)); setTo(ymd(new Date())); }
    else if (preset === "7d") { setFrom(daysAgo(6)); setTo(ymd(new Date())); }
    else if (preset === "30d") { setFrom(daysAgo(29)); setTo(ymd(new Date())); }
  }, [preset]);

  const filter = useMemo(() => {
    const f: { from: string; to: string; landingId?: number; formId?: number; utmKey?: string; utmValue?: string } = { from, to };
    if (target.startsWith("landing:")) f.landingId = Number(target.slice(8));
    else if (target.startsWith("form:")) f.formId = Number(target.slice(5));
    if (utmSel) { f.utmKey = utmSel.key; f.utmValue = utmSel.value; }
    return f;
  }, [from, to, target, utmSel]);

  useEffect(() => {
    if (!from || !to) return;
    setLoading(true);
    getStats(filter)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [filter, from, to]);

  const empty = stats && stats.summary.totalVisits === 0 && stats.summary.leads === 0;
  const buckets = useMemo(() => (stats ? bucketize(stats.byDay, grain) : []), [stats, grain]);
  // 유입별 표 — 값이 "(없음)"뿐인 축은 굳이 보여줄 게 없다(전부 오가닉). 탭에서 흐리게 표시.
  const utmTables = stats?.byUtmTables ?? [];
  const currentUtmRows = utmTables.find((t) => t.key === utmTab)?.rows ?? [];

  function toggleSection(key: string) {
    setReportSections((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function onExportExcel() {
    if (exporting || reportSections.length === 0) return;
    setExporting(true);
    try {
      const r = reportRange(reportUnit, { from, to });
      await downloadStatsReport(
        { ...filter, from: r.from, to: r.to },
        reportSections,
        `리드팟_${r.name}_${r.from}_${r.to}`,
      );
      toast.success("엑셀 보고서를 내려받았습니다.");
    } catch {
      toast.error("보고서 생성에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  }

  function onOpenReportView() {
    if (reportSections.length === 0) return;
    const r = reportRange(reportUnit, { from, to });
    const p = new URLSearchParams({ from: r.from, to: r.to, name: r.name, sections: reportSections.join(",") });
    if (filter.landingId != null) p.set("landingId", String(filter.landingId));
    if (filter.formId != null) p.set("formId", String(filter.formId));
    if (utmSel) { p.set("utmKey", utmSel.key); p.set("utmValue", utmSel.value); }
    window.open(`/stats/report?${p.toString()}`, "_blank");
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">통계</p>
            <h1 className="dash-title">수집 통계</h1>
            <p className="dash-sub">유입(방문) · 접수(리드) · 전환율 — 기간/대상별 분석</p>
          </div>
          <div className="edit-actions">
            <button className="btn btn-primary" onClick={() => setReportOpen(true)} title="현재 필터 기반으로 엑셀·인쇄용 보고서를 만듭니다">
              보고서·엑셀
            </button>
          </div>
        </div>

        {/* 필터바 */}
        <div className="stats-filter card card-pad">
          <div className="sf-group">
            <span className="sf-label">기간</span>
            <div className="seg">
              {([["today", "오늘"], ["7d", "7일"], ["30d", "30일"], ["custom", "직접"]] as [Preset, string][]).map(([p, l]) => (
                <button key={p} type="button" className={preset === p ? "on" : ""} onClick={() => setPreset(p)}>{l}</button>
              ))}
            </div>
            {preset === "custom" && (
              <span className="sf-dates">
                <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
                <span>~</span>
                <input type="date" value={to} min={from} max={ymd(new Date())} onChange={(e) => setTo(e.target.value)} />
              </span>
            )}
          </div>
          <div className="sf-group">
            <span className="sf-label">대상</span>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="all">전체</option>
              {landings.length > 0 && (
                <optgroup label="랜딩페이지">
                  {landings.map((l) => <option key={`l${l.id}`} value={`landing:${l.id}`}>{l.title}</option>)}
                </optgroup>
              )}
              {forms.length > 0 && (
                <optgroup label="리드폼">
                  {forms.map((f) => <option key={`f${f.id}`} value={`form:${f.id}`}>{f.name}</option>)}
                </optgroup>
              )}
            </select>
          </div>
          {utmSel && (
            <div className="sf-group">
              <span className="sf-label">유입</span>
              <button className="btn btn-sm btn-primary" onClick={() => setUtmSel(null)}
                title="클릭하면 유입 필터를 해제합니다">
                {trackingKeyLabel(utmSel.key)} = {utmSel.value} ✕
              </button>
            </div>
          )}
        </div>

        {/* 개요 / 여정 분석 탭 */}
        <div className="seg" style={{ marginTop: 16 }}>
          <button type="button" className={view === "overview" ? "on" : ""} onClick={() => setView("overview")}>개요</button>
          <button type="button" className={view === "journey" ? "on" : ""} onClick={() => setView("journey")}>여정 분석</button>
        </div>

        {loading && !stats ? (
          <Loading />
        ) : !stats ? (
          <div className="card card-pad empty-state" style={{ marginTop: 20 }}><p>통계를 불러오지 못했습니다.</p></div>
        ) : (
          <div style={{ opacity: loading ? 0.55 : 1, transition: "opacity .15s" }}>
          {view === "journey" ? (
            <JourneySection journey={stats.journey} empty={!!empty} />
          ) : (
          <>
            {/* 요약 */}
            <div className="kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginTop: 20 }}>
              <div className="kpi card"><div className="k-label">순 방문<span className="k-hint">고유</span></div><div className="k-val">{stats.summary.uniqueVisits.toLocaleString("ko-KR")}</div></div>
              <div className="kpi card"><div className="k-label">총 트래픽<span className="k-hint">중복 포함</span></div><div className="k-val">{stats.summary.totalVisits.toLocaleString("ko-KR")}</div></div>
              <div className="kpi card"><div className="k-label">접수(리드)</div><div className="k-val">{stats.summary.leads.toLocaleString("ko-KR")}</div></div>
              <div className="kpi card"><div className="k-label">전환율<span className="k-hint">순 방문 대비</span></div><div className="k-val">{stats.summary.conversionRate}<span style={{ fontSize: 16 }}>%</span></div></div>
            </div>

            {empty && (
              <div className="card card-pad empty-state" style={{ marginBottom: 20 }}>
                <p>이 기간/대상에 집계할 데이터가 없습니다. 공개 페이지에 방문·제출이 쌓이면 표시됩니다.</p>
              </div>
            )}

            {/* 추이 (트래픽 vs 리드) — 일/주/월 */}
            <section className="card card-pad">
              <div className="card-h" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span>추이</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
                  <span className="chart-legend"><i className="lg lg-v" />트래픽 <i className="lg lg-l" />리드</span>
                  <span className="seg seg-sm">
                    {([["day", "일별"], ["week", "주간"], ["month", "월별"]] as [Grain, string][]).map(([g, l]) => (
                      <button key={g} type="button" className={grain === g ? "on" : ""} onClick={() => setGrain(g)}>{l}</button>
                    ))}
                  </span>
                </span>
              </div>
              <TrendChart buckets={buckets} />
            </section>

            {/* 전환 퍼널(I4) + 요소 클릭(I5) */}
            <div className="stats-grid">
              <FunnelCard funnel={stats.funnel} />
              <BarCard title="요소 클릭 (폼 열기 등)" data={stats.byEvent} />
            </div>

            {/* 유입별 비교 표 — 매체/캠페인/광고 축 전환, 행 클릭 → 그 유입만 보기 */}
            <section className="card card-pad">
              <div className="card-h" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span>유입별 (광고 URL 파라미터)</span>
                <span className="seg seg-sm">
                  {UTM_TABLE_KEYS.map((k) => (
                    <button key={k} type="button" className={utmTab === k ? "on" : ""} onClick={() => setUtmTab(k)}>
                      {trackingKeyLabel(k)}
                    </button>
                  ))}
                </span>
              </div>
              <UtmValueTable
                rows={currentUtmRows}
                activeValue={utmSel?.key === utmTab ? utmSel.value : null}
                onPick={(value) => setUtmSel(utmSel?.key === utmTab && utmSel.value === value ? null : { key: utmTab, value })}
              />
              <p className="dash-sub" style={{ marginTop: 10, fontSize: 12 }}>
                행을 클릭하면 페이지 전체가 그 유입만으로 다시 계산됩니다. "(없음)" = 파라미터 없이 들어온 방문·리드(직접 유입 등).
              </p>
            </section>

            {/* 랜딩별 / 리드폼별 */}
            <div className="stats-grid">
              <EntityTable title="랜딩페이지별" rows={stats.byLanding} onPick={(id) => setTarget(id == null ? "all" : `landing:${id}`)} />
              <EntityTable title="리드폼별" rows={stats.byForm} onPick={(id) => setTarget(id == null ? "all" : `form:${id}`)} />
            </div>

            {/* 상세 dimension (리드 기준) */}
            <p className="dash-sub" style={{ marginTop: 26, marginBottom: 10, fontWeight: 700 }}>상세 (접수 리드 기준)</p>
            <div className="stats-grid">
              <BarCard title="기기" data={stats.byDevice} />
              <BarCard title="OS" data={stats.byOs} />
              <BarCard title="브라우저" data={stats.byBrowser} />
              <BarCard title="상태" data={stats.byStatus} />
              {/* 자체 광고 파라미터(광고 URL 빌더 3종) — 표준 UTM 카드보다 앞에(우리 도구가 만든 축이 주 지표) */}
              <BarCard title="광고 매체 (media_from)" data={stats.byMediaFrom} />
              <BarCard title="캠페인 이름 (campaign_name)" data={stats.byCampaignName} />
              <BarCard title="광고 이름 (ads_name)" data={stats.byAdsName} />
              <BarCard title="UTM 소스" data={stats.byUtmSource} />
              <BarCard title="UTM 매체" data={stats.byUtmMedium} />
              <BarCard title="UTM 캠페인" data={stats.byUtmCampaign} />
              <BarCard title="유입 경로" data={stats.byReferer} />
            </div>
          </>
          )}
          </div>
        )}

        {/* 보고서 모달 — 기간 단위 + 섹션 선택 → 엑셀 다운로드 / 인쇄용 화면 */}
        {reportOpen && (
          <div
            onClick={() => !exporting && setReportOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
          >
            <div className="card card-pad" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto" }}>
              <div className="card-h">통계 보고서 만들기</div>
              <p className="dash-sub" style={{ marginTop: 0 }}>
                현재 필터(대상{utmSel ? " · 유입" : ""})가 그대로 적용됩니다. 기간만 아래에서 고르세요.
              </p>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "6px 0 14px" }}>
                <span className="dash-sub" style={{ fontSize: 13 }}>기간</span>
                <span className="seg seg-sm">
                  {([["current", "화면 기간"], ["daily", "일간(오늘)"], ["weekly", "주간(7일)"], ["monthly", "월간(이번 달)"]] as [ReportUnit, string][]).map(([u, l]) => (
                    <button key={u} type="button" className={reportUnit === u ? "on" : ""} onClick={() => setReportUnit(u)}>{l}</button>
                  ))}
                </span>
                <span className="dash-sub" style={{ fontSize: 12 }}>
                  {(() => { const r = reportRange(reportUnit, { from, to }); return `${r.from} ~ ${r.to}`; })()}
                </span>
              </div>

              <div className="dash-sub" style={{ fontSize: 13, marginBottom: 6 }}>보고서에 넣을 내용</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16 }}>
                {REPORT_SECTIONS.map((s) => (
                  <label key={s.key} style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 13.5, cursor: "pointer" }}>
                    <input type="checkbox" checked={reportSections.includes(s.key)} onChange={() => toggleSection(s.key)} />
                    {s.label}
                  </label>
                ))}
              </div>
              {reportSections.length === 0 && (
                <p className="auth-error" style={{ fontSize: 13 }}>내용을 하나 이상 선택하세요.</p>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button className="btn btn-ghost" disabled={exporting} onClick={() => setReportOpen(false)}>닫기</button>
                <button className="btn btn-ghost" disabled={exporting || reportSections.length === 0} onClick={onOpenReportView}
                  title="인쇄/PDF 저장용 보고서 화면을 새 탭으로 엽니다">
                  보고서 화면 열기
                </button>
                <button className="btn btn-primary" disabled={exporting || reportSections.length === 0} onClick={onExportExcel}>
                  {exporting ? "만드는 중…" : "엑셀 다운로드"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function FunnelCard({ funnel }: { funnel: StatFunnel }) {
  const stages = [
    { label: "방문", hint: "순방문", value: funnel.visits, rate: null as string | null },
    { label: "폼 열기", hint: "오버레이 CTA 클릭", value: funnel.formOpens, rate: `${funnel.openRate}%` },
    { label: "접수", hint: "리드 제출", value: funnel.leads, rate: `${funnel.submitRate}%` },
  ];
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <section className="card card-pad">
      <div className="card-h">전환 퍼널</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {stages.map((s) => (
          <div key={s.label}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13, marginBottom: 4 }}>
              <span>
                <span style={{ fontWeight: 700 }}>{s.label}</span>
                {s.rate && <span className="dash-sub" style={{ marginLeft: 8, fontSize: 12 }}>이전 대비 {s.rate}</span>}
              </span>
              <span style={{ fontWeight: 800 }}>{s.value.toLocaleString("ko-KR")}</span>
            </div>
            <span style={{ display: "block", height: 12, borderRadius: 7, background: "var(--surface-2)", overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", borderRadius: 7, width: `${(s.value / max) * 100}%`, background: "var(--indigo)", transition: "width .2s" }} />
            </span>
          </div>
        ))}
      </div>
      <p className="dash-sub" style={{ marginTop: 12, fontSize: 12 }}>
        '폼 열기'는 오버레이 CTA(버튼→폼) 클릭만 집계됩니다. 인라인 폼·단독 리드폼은 방문→접수로 봅니다.
      </p>
    </section>
  );
}

/** 체류 시간(초) → "N분 M초"/"N초" 표시. */
function fmtDuration(sec: number): string {
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

/** 고객 여정 분석(I6) — 스크롤 깊이별 도달률 + 평균 체류시간 + 즉시 이탈률. */
function JourneySection({ journey, empty }: { journey: StatJourney; empty: boolean }) {
  const completeRate = journey.scrollFunnel.find((p) => p.depth === 100)?.rate ?? 0;
  return (
    <>
      <div className="kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginTop: 20 }}>
        <div className="kpi card"><div className="k-label">평균 체류시간</div><div className="k-val">{fmtDuration(journey.avgDurationSec)}</div></div>
        <div className="kpi card"><div className="k-label">즉시 이탈률<span className="k-hint">스크롤 25% 미만</span></div><div className="k-val">{journey.bounceRate}<span style={{ fontSize: 16 }}>%</span></div></div>
        <div className="kpi card"><div className="k-label">완독률<span className="k-hint">100% 도달</span></div><div className="k-val">{completeRate}<span style={{ fontSize: 16 }}>%</span></div></div>
      </div>

      {empty && (
        <div className="card card-pad empty-state" style={{ margin: "20px 0" }}>
          <p>이 기간/대상에 집계할 데이터가 없습니다. 공개 랜딩에 방문이 쌓이면 표시됩니다.</p>
        </div>
      )}

      <section className="card card-pad" style={{ marginTop: 20 }}>
        <div className="card-h">스크롤 깊이별 도달률</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {journey.scrollFunnel.map((p) => (
            <div key={p.depth}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13, marginBottom: 4 }}>
                <span style={{ fontWeight: 700 }}>{p.depth}% 지점</span>
                <span style={{ fontWeight: 800 }}>
                  {p.reached.toLocaleString("ko-KR")}명
                  <span className="dash-sub" style={{ marginLeft: 6, fontWeight: 400, fontSize: 12 }}>({p.rate}%)</span>
                </span>
              </div>
              <span style={{ display: "block", height: 12, borderRadius: 7, background: "var(--surface-2)", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", borderRadius: 7, width: `${p.rate}%`, background: "var(--indigo)", transition: "width .2s" }} />
              </span>
            </div>
          ))}
        </div>
        <p className="dash-sub" style={{ marginTop: 12, fontSize: 12 }}>
          순방문({journey.sessions.toLocaleString("ko-KR")}명) 대비 각 지점까지 스크롤한 방문자 비율입니다. IP 기준 추정치라 실제와 소폭 차이가 있을 수 있습니다.
        </p>
      </section>
    </>
  );
}
