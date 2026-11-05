import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { FormPace, FormPaceItem } from "../api/client";
import { compare, fmt } from "../lib/pace";
import { DiffLine } from "./LeadPaceCard";

/**
 * '리드폼별 오늘 추이' 표(2026-11-05 사용자 요청).
 * 리드폼마다 오늘 지금까지 접수를 어제 이시간 · 최근 7일 평균 이시간과 비교하고(차이 건수·%),
 * 최근 7일 하루 평균·어제 하루 전체 접수도 같이 보여준다. 행을 누르면 그 리드폼의 리드 목록으로.
 *
 * - compact: 대시보드용 — 상위 몇 줄만 + '오늘 추이' 페이지 링크
 * - full: '오늘 추이' 페이지(/trend)용 — 전체 + 검색·정렬
 */

type SortKey = "today" | "up" | "down" | "avg" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "today", label: "오늘 많은 순" },
  { key: "up", label: "평소보다 많이 오른 순" },
  { key: "down", label: "평소보다 많이 떨어진 순" },
  { key: "avg", label: "7일 하루 평균 순" },
  { key: "name", label: "이름 순" },
];

const COMPACT_ROWS = 5;

// 평소(7일 평균 이시간) 대비 증감률. 평소 0 인데 오늘 들어왔으면 가장 크게 오른 것으로 본다.
function changeRate(it: FormPaceItem): number {
  if (it.usual > 0) return (it.today - it.usual) / it.usual;
  return it.today > 0 ? Number.POSITIVE_INFINITY : 0;
}

function sortItems(items: FormPaceItem[], key: SortKey): FormPaceItem[] {
  const list = [...items];
  switch (key) {
    case "up":
      return list.sort((a, b) => changeRate(b) - changeRate(a) || b.today - a.today);
    case "down":
      return list.sort((a, b) => changeRate(a) - changeRate(b) || b.usual - a.usual);
    case "avg":
      return list.sort((a, b) => b.dailyAvg - a.dailyAvg || b.today - a.today);
    case "name":
      return list.sort((a, b) => a.formName.localeCompare(b.formName, "ko"));
    default:
      return list; // 서버가 오늘 많은 순으로 내려준다
  }
}

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

export function FormPaceCard({ data, mode = "compact" }: { data: FormPace | null | "error"; mode?: "compact" | "full" }) {
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortKey>("today");
  const [q, setQ] = useState("");
  const full = mode === "full";

  const items = useMemo(() => (data && data !== "error" ? data.items : []), [data]);
  const rows = useMemo(() => {
    if (!full) return items.slice(0, COMPACT_ROWS);
    const needle = q.trim().toLowerCase();
    const filtered = needle ? items.filter((it) => it.formName.toLowerCase().includes(needle)) : items;
    return sortItems(filtered, sort);
  }, [items, full, q, sort]);

  if (data === "error") {
    return full ? <p className="dash-sub card card-pad">추이를 불러오지 못했습니다. 잠시 후 새로고침해주세요.</p> : null;
  }
  const days = data?.usualDays ?? 7;

  return (
    <section className="card fpace-card">
      <div className="card-pad fpace-head">
        <span className="card-h" style={{ margin: 0 }}>리드폼별 오늘 추이</span>
        <span className="dash-sub" style={{ margin: 0, fontSize: 12.5 }}>
          {data ? `오늘 00:00 ~ ${data.asOf} 기준 · 차이는 오늘 기준` : "불러오는 중…"}
        </span>
      </div>

      {full && data && items.length > 0 && (
        <div className="card-pad fpace-tools">
          <input
            className="input"
            placeholder="리드폼 이름 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      )}

      {data && items.length === 0 && (
        <p className="dash-sub card-pad" style={{ margin: 0, paddingTop: 0 }}>
          최근 {days}일 동안 접수된 리드가 없어요.
        </p>
      )}
      {data && items.length > 0 && rows.length === 0 && (
        <p className="dash-sub card-pad" style={{ margin: 0, paddingTop: 0 }}>검색 결과가 없어요.</p>
      )}

      {data && rows.length > 0 && (
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
              {rows.map((it) => (
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
      )}

      {data && items.length > 0 && (
        <div className="card-pad fpace-foot">
          <span className="dash-sub" style={{ margin: 0, fontSize: 12 }}>
            '이시간' = 그날 00:00 ~ {data.asOf} 누적 · {days}일 = 어제부터 {days}일(오늘 제외) · 최근 {days}일 접수가 있는 리드폼만
          </span>
          {!full && (
            <Link to="/trend" style={{ fontSize: 12.5, fontWeight: 700 }}>
              {items.length > COMPACT_ROWS ? `리드폼 ${items.length}개 모두 보기 →` : "오늘 추이 자세히 보기 →"}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
