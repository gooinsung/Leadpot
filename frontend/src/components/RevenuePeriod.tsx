import { useEffect, useState } from "react";
import { getRevenue, type RevenueRow } from "../api/client";

/** 목록(리드폼·랜딩)의 '수익' 열 기간 — 기간 선택은 브라우저에 기억한다(편의 기능). */
export type RevenuePeriodKey = "today" | "7d" | "30d" | "month";

const LABELS: Record<RevenuePeriodKey, string> = {
  today: "오늘",
  "7d": "최근 7일",
  "30d": "최근 30일",
  month: "이번 달",
};
const STORAGE_KEY = "leadpot.list.revenuePeriod";

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function range(key: RevenuePeriodKey): { from: string; to: string } {
  const now = new Date();
  const to = ymd(now);
  if (key === "today") return { from: to, to };
  if (key === "month") return { from: `${to.slice(0, 8)}01`, to };
  const d = new Date(now);
  d.setDate(d.getDate() - (key === "7d" ? 6 : 29));
  return { from: ymd(d), to };
}

function loadPeriod(): RevenuePeriodKey {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && v in LABELS) return v as RevenuePeriodKey;
  } catch {
    // 저장소 접근 불가 — 기본값
  }
  return "30d";
}

/**
 * 기간별 수익(리드당 가치 합, V44)을 리드폼 id·랜딩 id 로 찾을 수 있게 불러온다.
 * 값이 없으면(그 기간 리드 0건) 0원.
 */
export function useRevenueByEntity() {
  const [period, setPeriodState] = useState<RevenuePeriodKey>(loadPeriod);
  const [byForm, setByForm] = useState<Map<number, RevenueRow>>(new Map());
  const [byLanding, setByLanding] = useState<Map<number, RevenueRow>>(new Map());

  useEffect(() => {
    const { from, to } = range(period);
    let alive = true;
    getRevenue(from, to)
      .then((r) => {
        if (!alive) return;
        const toMap = (rows: RevenueRow[]) => new Map(rows.filter((x) => x.id != null).map((x) => [x.id as number, x]));
        setByForm(toMap(r.byForm));
        setByLanding(toMap(r.byLanding));
      })
      .catch(() => {
        if (!alive) return;
        setByForm(new Map());
        setByLanding(new Map());
      });
    return () => {
      alive = false;
    };
  }, [period]);

  function setPeriod(p: RevenuePeriodKey) {
    setPeriodState(p);
    try {
      window.localStorage.setItem(STORAGE_KEY, p);
    } catch {
      // 저장 불가 — 이번 화면에서만 유지
    }
  }

  return { period, setPeriod, byForm, byLanding };
}

/** '수익' 열 머리 — 기간 드롭다운 포함. */
export function RevenueHeader({ period, onChange }: { period: RevenuePeriodKey; onChange: (p: RevenuePeriodKey) => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
      수익
      <select
        className="input"
        style={{ height: 26, padding: "0 6px", fontSize: 12, width: "auto" }}
        value={period}
        onChange={(e) => onChange(e.target.value as RevenuePeriodKey)}
        onClick={(e) => e.stopPropagation()}
        title="수익 집계 기간(리드당 가치 × 접수 리드)"
      >
        {(Object.keys(LABELS) as RevenuePeriodKey[]).map((k) => (
          <option key={k} value={k}>{LABELS[k]}</option>
        ))}
      </select>
    </span>
  );
}

/** 금액 칸 — 리드 수를 툴팁으로. */
export function RevenueCell({ row }: { row: RevenueRow | undefined }) {
  const revenue = row?.revenue ?? 0;
  return (
    <span title={`접수 ${row?.leads ?? 0}건`} className={revenue === 0 ? "dash-sub" : undefined}>
      {revenue.toLocaleString("ko-KR")}원
    </span>
  );
}
