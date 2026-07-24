import { useEffect, useState } from "react";
import { getStats, type StatCount, type StatsOverview } from "../api/client";
import { TopBar } from "../components/TopBar";

export function StatsPage() {
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">통계</p>
            <h1 className="dash-title">수집 통계</h1>
            <p className="dash-sub">방문자 제출 데이터 기반 · 최근 30일</p>
          </div>
        </div>

        {loading ? (
          <p className="dash-sub">불러오는 중…</p>
        ) : !stats || stats.total === 0 ? (
          <div className="card card-pad empty-state">
            <p>아직 집계할 리드가 없습니다. 폼/랜딩을 공개해 제출이 쌓이면 통계가 표시됩니다.</p>
          </div>
        ) : (
          <>
            <div className="kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              <div className="kpi card"><div className="k-label">총 리드</div><div className="k-val">{stats.total.toLocaleString("ko-KR")}</div></div>
              <div className="kpi card"><div className="k-label">기기 종류</div><div className="k-val">{stats.byDevice.length}</div></div>
              <div className="kpi card"><div className="k-label">유입 경로</div><div className="k-val">{stats.byReferer.length}</div></div>
              <div className="kpi card"><div className="k-label">활성 폼</div><div className="k-val">{stats.byForm.length}</div></div>
            </div>

            <section className="card card-pad" style={{ marginTop: 20 }}>
              <div className="card-h">일별 추이 (최근 30일)</div>
              <DayChart data={stats.byDay} />
            </section>

            <div className="stats-grid">
              <BarCard title="기기별" data={stats.byDevice} total={stats.total} />
              <BarCard title="유입 경로 (상위)" data={stats.byReferer} total={stats.total} />
              <BarCard title="UTM 소스" data={stats.byUtmSource} total={stats.total} />
              <BarCard title="폼별" data={stats.byForm.map((f) => ({ key: f.name, count: f.count }))} total={stats.total} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function DayChart({ data }: { data: StatCount[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="day-chart">
      {data.map((d) => (
        <div className="day-bar-wrap" key={d.key} title={`${d.key} · ${d.count}건`}>
          <div className="day-bar" style={{ height: `${(d.count / max) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

function BarCard({ title, data, total }: { title: string; data: StatCount[]; total: number }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <section className="card card-pad">
      <div className="card-h">{title}</div>
      {data.length === 0 ? (
        <p className="dash-sub">데이터 없음</p>
      ) : (
        <div className="bar-list">
          {data.map((d) => (
            <div className="bar-row" key={d.key}>
              <span className="bar-label" title={d.key}>{d.key}</span>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${(d.count / max) * 100}%` }} /></span>
              <span className="bar-count">{d.count}<span className="bar-pct"> · {Math.round((d.count / total) * 100)}%</span></span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
