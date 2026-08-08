import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getGoalReport, type GoalReportRow } from "../api/client";
import { Loading } from "../components/Loading";
import { TopBar } from "../components/TopBar";
import { toast } from "../lib/toast";

/** 2026-08-11 → "8/11 (월)" — 표가 길어 날짜는 짧게 보여준다. */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const day = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()} (${day})`;
}

/** "2026-08" → "2026년 8월" */
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}년 ${Number(m)}월`;
}

function MetBadge({ met }: { met: boolean | null }) {
  if (met === null) {
    return <span className="dash-sub">—</span>;
  }
  return met ? (
    <span className="badge b-normal">달성</span>
  ) : (
    <span className="badge b-wait">미달</span>
  );
}

/**
 * 목표 보고서(2026-08-09) — 리드폼 편집에서 켠 일간/월간 목표의 달성 현황.
 * 설정은 여기서 못 바꾼다(리드폼 편집으로 안내) — 보고서와 설정을 한 화면에 섞지 않는다.
 */
export function GoalsPage() {
  const [rows, setRows] = useState<GoalReportRow[] | null>(null);

  useEffect(() => {
    getGoalReport()
      .then(setRows)
      .catch(() => {
        toast.error("목표 보고서를 불러오지 못했습니다.");
        setRows([]);
      });
  }, []);

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">운영</p>
            <h1 className="dash-title">목표</h1>
            <p className="dash-sub">
              리드폼별 일간·월간 수집 목표의 달성 현황입니다. 목표는 <Link to="/forms">리드폼</Link> 편집
              화면의 <b>옵션 → 수집 목표 설정</b>에서 켭니다.
            </p>
          </div>
        </div>

        {rows === null ? (
          <Loading full />
        ) : rows.length === 0 ? (
          <div className="card card-pad">
            <div className="empty-state">
              <p>목표를 설정한 리드폼이 없습니다.</p>
              <Link className="btn btn-primary" to="/forms">
                리드폼에서 목표 켜기
              </Link>
            </div>
          </div>
        ) : (
          rows.map((r) => (
            <div className="card card-pad" style={{ marginBottom: 16 }} key={r.formId}>
              <div className="card-h" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Link to={`/forms/${r.formId}`}>{r.formName}</Link>
                {r.active ? (
                  <span className="pill i">진행 중</span>
                ) : (
                  <span className="pill">기간 아님</span>
                )}
                <span className="dash-sub" style={{ fontWeight: 400 }}>
                  {r.startDate} ~ {r.endDate}
                </span>
              </div>

              {/* 기간 경과율 — 목표 대비 페이스를 가늠하는 기준선 */}
              <div className="goal-progress" style={{ margin: "4px 0 14px" }}>
                <div
                  style={{
                    height: 6,
                    borderRadius: 999,
                    background: "var(--border)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.round(r.periodProgress * 100)}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: "var(--indigo)",
                    }}
                  />
                </div>
                <p className="dash-sub" style={{ fontSize: 12, marginTop: 4 }}>
                  기간 경과 {Math.round(r.periodProgress * 100)}%
                </p>
              </div>

              <div className="kpis kpis-3" style={{ marginBottom: 14 }}>
                <div className="kpi">
                  <div className="k-label">오늘 {r.dailyTarget > 0 && `/ 일간 목표 ${r.dailyTarget.toLocaleString()}`}</div>
                  <div className="k-val">
                    {r.todayCount.toLocaleString()}
                    {r.dailyTarget > 0 && (
                      <span className="dash-sub" style={{ fontSize: 14 }}> / {r.dailyTarget.toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="kpi">
                  <div className="k-label">이번 달 {r.monthlyTarget > 0 && `/ 월간 목표 ${r.monthlyTarget.toLocaleString()}`}</div>
                  <div className="k-val">
                    {r.monthCount.toLocaleString()}
                    {r.monthlyTarget > 0 && (
                      <span className="dash-sub" style={{ fontSize: 14 }}> / {r.monthlyTarget.toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="kpi">
                  <div className="k-label">기간 누적</div>
                  <div className="k-val">{r.totalCount.toLocaleString()}</div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                <div>
                  <div className="dash-sub" style={{ marginBottom: 6 }}>
                    일별 (최근 {r.days.length}일)
                  </div>
                  <div className="card card-table">
                    <table>
                      <thead>
                        <tr>
                          <th>날짜</th>
                          <th>접수</th>
                          <th>일간 목표</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.days.map((d) => (
                          <tr key={d.date}>
                            <td>{shortDate(d.date)}</td>
                            <td>
                              {d.count.toLocaleString()}
                              {r.dailyTarget > 0 && (
                                <span className="dash-sub"> / {r.dailyTarget.toLocaleString()}</span>
                              )}
                            </td>
                            <td>
                              <MetBadge met={d.met} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <div className="dash-sub" style={{ marginBottom: 6 }}>
                    월별
                  </div>
                  <div className="card card-table">
                    <table>
                      <thead>
                        <tr>
                          <th>월</th>
                          <th>접수</th>
                          <th>월간 목표</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.months.map((m) => (
                          <tr key={m.month}>
                            <td>{monthLabel(m.month)}</td>
                            <td>
                              {m.count.toLocaleString()}
                              {r.monthlyTarget > 0 && (
                                <span className="dash-sub"> / {r.monthlyTarget.toLocaleString()}</span>
                              )}
                            </td>
                            <td>
                              <MetBadge met={m.met} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
