import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FormPace, FormPaceItem } from "../api/client";
import { compare, fmt } from "../lib/pace";
import { DiffLine } from "./LeadPaceCard";

/**
 * 대시보드 '리드폼별 오늘 추이' 카드(2026-11-05 사용자 요청).
 * 리드폼마다 오늘 지금까지 접수를 어제 이시간 · 최근 7일 평균 이시간과 비교하고(차이 건수·%),
 * 최근 7일 하루 평균·어제 하루 전체 접수도 같이 보여준다. 행을 누르면 그 리드폼의 리드 목록으로.
 */

const COLLAPSED_ROWS = 8;

function Badge({ item }: { item: FormPaceItem }) {
  if (item.today === 0 && item.usual === 0 && item.yesterday === 0) {
    return <span className="fpace-badge pace-flat">이 시간대 접수 없음</span>;
  }
  const { tone, pct } = compare(item.today, item.usual);
  const text =
    tone === "up"
      ? pct != null ? `평소보다 ${pct}% ↑` : "평소보다 많음"
      : tone === "down"
        ? pct != null ? `평소보다 ${Math.abs(pct)}% ↓` : "평소보다 적음"
        : "평소와 비슷";
  return <span className={`fpace-badge fpace-badge-${tone}`}>{text}</span>;
}

export function FormPaceCard({ data }: { data: FormPace | null | "error" }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  if (data === "error") return null;

  const items = data?.items ?? [];
  const shown = expanded ? items : items.slice(0, COLLAPSED_ROWS);
  const days = data?.usualDays ?? 7;

  return (
    <section className="card fpace-card">
      <div className="card-pad fpace-head">
        <span className="card-h" style={{ margin: 0 }}>리드폼별 오늘 추이</span>
        <span className="dash-sub" style={{ margin: 0, fontSize: 12.5 }}>
          {data ? `오늘 00:00 ~ ${data.asOf} 기준 · 차이는 오늘 기준` : "불러오는 중…"}
        </span>
      </div>

      {data && items.length === 0 && (
        <p className="dash-sub card-pad" style={{ margin: 0, paddingTop: 0 }}>
          최근 {days}일 동안 접수된 리드가 없어요.
        </p>
      )}

      {data && items.length > 0 && (
        <>
          <div className="card-table fpace-table">
            <table>
              <thead>
                <tr>
                  <th>리드폼</th>
                  <th className="fpace-r">오늘 지금까지</th>
                  <th className="fpace-r">어제 이시간</th>
                  <th className="fpace-r">{days}일 평균 이시간</th>
                  <th>판정</th>
                  <th className="fpace-r">{days}일 하루 평균</th>
                  <th className="fpace-r">어제 하루</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((it) => (
                  <tr key={it.formId} className="row-click" onClick={() => navigate(`/forms/${it.formId}/leads`)}>
                    <td className="fpace-name" title={it.formName}>{it.formName}</td>
                    <td className="fpace-r">
                      <b className="tnum fpace-today">{fmt(it.today)}건</b>
                    </td>
                    <td className="fpace-r">
                      <span className="tnum">{fmt(it.yesterday)}건</span>
                      <DiffLine today={it.today} base={it.yesterday} />
                    </td>
                    <td className="fpace-r">
                      <span className="tnum">{fmt(it.usual)}건</span>
                      <DiffLine today={it.today} base={it.usual} />
                    </td>
                    <td><Badge item={it} /></td>
                    <td className="fpace-r">
                      <span className="tnum">{fmt(it.dailyAvg)}건</span>
                      <span className="fpace-sub">{days}일 합계 {fmt(it.weekTotal)}건</span>
                    </td>
                    <td className="fpace-r"><span className="tnum">{fmt(it.yesterdayTotal)}건</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-pad fpace-foot">
            <span className="dash-sub" style={{ margin: 0, fontSize: 12 }}>
              '이시간' = 그날 00:00 ~ {data.asOf} 누적 · {days}일 = 어제부터 {days}일(오늘 제외) · 최근 {days}일 접수가 있는 리드폼만
            </span>
            {items.length > COLLAPSED_ROWS && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpanded((v) => !v)}>
                {expanded ? "접기" : `${items.length - COLLAPSED_ROWS}개 더 보기`}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
