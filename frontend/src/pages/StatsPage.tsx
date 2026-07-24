import { useEffect, useMemo, useState } from "react";
import {
  getStats,
  listForms,
  listLandings,
  type FormSummary,
  type LandingSummary,
  type StatCount,
  type StatDayPoint,
  type StatEntityCount,
  type StatsOverview,
} from "../api/client";
import { TopBar } from "../components/TopBar";

type Preset = "today" | "7d" | "30d" | "custom";
type Grain = "day" | "week" | "month";

interface Bucket {
  key: string;
  label: string;
  tip: string;
  visits: number;
  leads: number;
}

const MMDD = (iso: string) => iso.slice(5).replace("-", "/");

/** 일별 데이터를 granularity(일/주/월)로 묶는다. byDay 는 날짜 오름차순·연속. */
function bucketize(byDay: StatDayPoint[], grain: Grain): Bucket[] {
  if (grain === "day") {
    return byDay.map((d) => ({
      key: d.date,
      label: MMDD(d.date),
      tip: `${d.date}\n트래픽 ${d.visits} · 리드 ${d.leads}`,
      visits: d.visits,
      leads: d.leads,
    }));
  }
  const map = new Map<string, Bucket & { first: string; last: string }>();
  const order: string[] = [];
  for (const d of byDay) {
    const [y, m, day] = d.date.split("-").map(Number);
    const dt = new Date(y, m - 1, day);
    let key: string;
    let label: string;
    if (grain === "week") {
      const monday = new Date(dt);
      monday.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); // 월요일 시작
      key = `${monday.getFullYear()}-${monday.getMonth() + 1}-${monday.getDate()}`;
      label = `${monday.getMonth() + 1}/${monday.getDate()}`;
    } else {
      key = `${y}-${String(m).padStart(2, "0")}`;
      label = `${m}월`;
    }
    let b = map.get(key);
    if (!b) {
      b = { key, label, tip: "", visits: 0, leads: 0, first: d.date, last: d.date };
      map.set(key, b);
      order.push(key);
    }
    b.visits += d.visits;
    b.leads += d.leads;
    b.last = d.date;
  }
  return order.map((k) => {
    const b = map.get(k)!;
    const range = grain === "week" ? `${MMDD(b.first)} ~ ${MMDD(b.last)}` : b.key;
    return { key: b.key, label: b.label, tip: `${range}\n트래픽 ${b.visits} · 리드 ${b.leads}`, visits: b.visits, leads: b.leads };
  });
}

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

export function StatsPage() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(ymd(new Date()));
  const [target, setTarget] = useState("all"); // all | landing:{id} | form:{id}
  const [grain, setGrain] = useState<Grain>("day");

  const [landings, setLandings] = useState<LandingSummary[]>([]);
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [loading, setLoading] = useState(true);

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
    const f: { from: string; to: string; landingId?: number; formId?: number } = { from, to };
    if (target.startsWith("landing:")) f.landingId = Number(target.slice(8));
    else if (target.startsWith("form:")) f.formId = Number(target.slice(5));
    return f;
  }, [from, to, target]);

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
        </div>

        {loading && !stats ? (
          <p className="dash-sub" style={{ marginTop: 20 }}>불러오는 중…</p>
        ) : !stats ? (
          <div className="card card-pad empty-state" style={{ marginTop: 20 }}><p>통계를 불러오지 못했습니다.</p></div>
        ) : (
          <div style={{ opacity: loading ? 0.55 : 1, transition: "opacity .15s" }}>
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
              <BarCard title="UTM 소스" data={stats.byUtmSource} />
              <BarCard title="UTM 매체" data={stats.byUtmMedium} />
              <BarCard title="UTM 캠페인" data={stats.byUtmCampaign} />
              <BarCard title="유입 경로" data={stats.byReferer} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function TrendChart({ buckets }: { buckets: Bucket[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.visits, b.leads)));
  // 라벨은 막대가 많을 때 일부만 노출(과밀 방지)
  const step = Math.ceil(buckets.length / 12) || 1;
  return (
    <div className="trend">
      <div className="day-chart" onMouseLeave={() => setHover(null)}>
        {buckets.map((b, i) => (
          <div
            className={`day-bar-wrap${hover === i ? " on" : ""}`}
            key={b.key}
            onMouseEnter={() => setHover(i)}
          >
            {hover === i && (
              <div className="day-tip">
                {b.tip.split("\n").map((line, j) => <div key={j} className={j === 0 ? "day-tip-t" : ""}>{line}</div>)}
              </div>
            )}
            <div className="day-bar day-bar-v" style={{ height: `${(b.visits / max) * 100}%` }} />
            <div className="day-bar day-bar-l" style={{ height: `${(b.leads / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="day-axis">
        {buckets.map((b, i) => (
          <span key={b.key} className="day-axis-l">{i % step === 0 ? b.label : ""}</span>
        ))}
      </div>
    </div>
  );
}

function BarCard({ title, data }: { title: string; data: StatCount[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <section className="card card-pad">
      <div className="card-h">{title}</div>
      {data.length === 0 ? (
        <p className="dash-sub">데이터 없음</p>
      ) : (
        <div className="bar-list">
          {data.slice(0, 8).map((d) => (
            <div className="bar-row" key={d.key}>
              <span className="bar-label" title={d.key}>{d.key}</span>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${(d.count / max) * 100}%` }} /></span>
              <span className="bar-count">{d.count}<span className="bar-pct"> · {total ? Math.round((d.count / total) * 100) : 0}%</span></span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EntityTable({ title, rows, onPick }: { title: string; rows: StatEntityCount[]; onPick: (id: number | null) => void }) {
  return (
    <section className="card card-pad">
      <div className="card-h">{title}</div>
      {rows.length === 0 ? (
        <p className="dash-sub">데이터 없음</p>
      ) : (
        <div className="stats-table-scroll">
          <table className="stats-table">
            <thead>
              <tr><th>이름</th><th className="num">순 방문</th><th className="num">트래픽</th><th className="num">리드</th><th className="num">전환율</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id ?? `none-${i}`} className="row-click" onClick={() => onPick(r.id)}>
                  <td className="et-name" title={r.name}>{r.name}</td>
                  <td className="num">{r.uniqueVisits}</td>
                  <td className="num">{r.totalVisits}</td>
                  <td className="num">{r.leads}</td>
                  <td className="num">{r.conversionRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
