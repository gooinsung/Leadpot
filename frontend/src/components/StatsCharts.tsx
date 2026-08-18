import { useState } from "react";
import type { StatCount, StatDayPoint, StatEntityCount } from "../api/client";

/**
 * 통계 화면 공용 조각 — 통계 페이지(StatsPage)와 보고서 화면(StatsReportPage)이 함께 쓴다.
 * 보고서에서도 같은 모양으로 보여야 하므로 여기 말고 페이지 안에 사본을 만들지 않는다.
 */

export type Grain = "day" | "week" | "month";

export interface Bucket {
  key: string;
  label: string;
  tip: string;
  visits: number;
  leads: number;
}

const MMDD = (iso: string) => iso.slice(5).replace("-", "/");

/** 일별 데이터를 granularity(일/주/월)로 묶는다. byDay 는 날짜 오름차순·연속. */
export function bucketize(byDay: StatDayPoint[], grain: Grain): Bucket[] {
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

export function TrendChart({ buckets }: { buckets: Bucket[] }) {
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

export function BarCard({ title, data }: { title: string; data: StatCount[] }) {
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

/** 대상(랜딩/폼)별 표. onPick 이 없으면 클릭 없는 읽기 전용(보고서용). */
export function EntityTable({ title, rows, onPick }: {
  title: string;
  rows: StatEntityCount[];
  onPick?: (id: number | null) => void;
}) {
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
                <tr
                  key={r.id ?? `none-${i}`}
                  className={onPick ? "row-click" : undefined}
                  onClick={onPick ? () => onPick(r.id) : undefined}
                >
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

/**
 * 유입별 비교 표 한 키 분량 — 값별 방문·리드·전환율.
 * onPick 이 있으면 행 클릭 → 그 값으로 유입 필터(통계 페이지). 보고서에서는 읽기 전용.
 */
export function UtmValueTable({ rows, activeValue, onPick }: {
  rows: { value: string; uniqueVisits: number; totalVisits: number; leads: number; conversionRate: number }[];
  activeValue?: string | null;
  onPick?: (value: string) => void;
}) {
  return rows.length === 0 ? (
    <p className="dash-sub">데이터 없음</p>
  ) : (
    <div className="stats-table-scroll">
      <table className="stats-table">
        <thead>
          <tr><th>값</th><th className="num">순 방문</th><th className="num">트래픽</th><th className="num">리드</th><th className="num">전환율</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.value}
              className={`${onPick ? "row-click" : ""}${activeValue === r.value ? " active" : ""}`.trim() || undefined}
              onClick={onPick ? () => onPick(r.value) : undefined}
              title={onPick ? "클릭하면 이 유입만 봅니다" : undefined}
            >
              <td className="et-name" title={r.value}>{r.value}</td>
              <td className="num">{r.uniqueVisits}</td>
              <td className="num">{r.totalVisits}</td>
              <td className="num">{r.leads}</td>
              <td className="num">{r.conversionRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
