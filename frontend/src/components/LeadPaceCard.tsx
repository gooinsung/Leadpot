import type { LeadPace } from "../api/client";

/**
 * 대시보드 '접수 페이스' 카드(2026-11-04 사용자 요청).
 * 오늘 지금 시각까지 접수가 어제 이시간 · 평상시(최근 7일 평균) 이시간보다 얼마나 많은지/적은지 대강 보여준다.
 */

type Tone = "up" | "down" | "flat";

// "대강" 보는 용도라 ±15% 미만이거나 차이가 1건 미만이면 "비슷"으로 본다(작은 숫자의 1건 차이로 요란하지 않게).
function compare(today: number, base: number): { tone: Tone; diff: number; pct: number | null } {
  const diff = Math.round((today - base) * 10) / 10;
  const pct = base > 0 ? Math.round((diff / base) * 100) : null;
  const flat = Math.abs(diff) < 1 || (pct != null && Math.abs(pct) < 15);
  return { tone: flat ? "flat" : diff > 0 ? "up" : "down", diff, pct };
}

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString("ko-KR") : n.toFixed(1));

function DiffLine({ today, base }: { today: number; base: number }) {
  const { tone, diff, pct } = compare(today, base);
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
  const arrow = tone === "up" ? "▲" : tone === "down" ? "▼" : "–";
  return (
    <span className={`pace-diff pace-${tone}`}>
      {arrow} {sign}
      {fmt(Math.abs(diff))}건{pct != null && diff !== 0 ? ` (${diff > 0 ? "+" : "−"}${Math.abs(pct)}%)` : ""}
    </span>
  );
}

function verdict(p: LeadPace): { text: string; tone: Tone } {
  if (p.today === 0 && p.usual === 0 && p.yesterday === 0) return { text: "이 시간대엔 원래 접수가 거의 없어요", tone: "flat" };
  const { tone, pct } = compare(p.today, p.usual);
  if (tone === "up") return { text: pct != null ? `평소보다 ${pct}% 많이 들어오는 중` : "평소보다 많이 들어오는 중", tone };
  if (tone === "down") return { text: pct != null ? `평소보다 ${Math.abs(pct)}% 적게 들어오는 중` : "평소보다 적게 들어오는 중", tone };
  return { text: "평소와 비슷하게 들어오는 중", tone };
}

export function LeadPaceCard({ pace }: { pace: LeadPace | null | "error" }) {
  if (pace === "error") return null;
  const max = pace ? Math.max(pace.today, pace.yesterday, pace.usual, 1) : 1;
  const bar = (v: number) => `${Math.max((v / max) * 100, v > 0 ? 3 : 0)}%`;
  const v = pace ? verdict(pace) : null;

  return (
    <section className="card card-pad pace-card">
      <div className="pace-head">
        <span className="card-h" style={{ margin: 0 }}>접수 페이스</span>
        <span className="dash-sub" style={{ margin: 0, fontSize: 12.5 }}>
          {pace ? `오늘 00:00 ~ ${pace.asOf} 기준 · 같은 시간대 비교` : "불러오는 중…"}
        </span>
      </div>
      {pace && v && (
        <>
          <p className={`pace-verdict pace-${v.tone}`}>{v.text}</p>
          <div className="pace-rows">
            <div className="pace-row">
              <span className="pace-label">오늘 지금까지</span>
              <span className="pace-track"><span className="pace-fill pace-fill-today" style={{ width: bar(pace.today) }} /></span>
              <span className="pace-num tnum">{fmt(pace.today)}건</span>
              <span className="pace-diff pace-flat" />
            </div>
            <div className="pace-row">
              <span className="pace-label">어제 이시간</span>
              <span className="pace-track"><span className="pace-fill" style={{ width: bar(pace.yesterday) }} /></span>
              <span className="pace-num tnum">{fmt(pace.yesterday)}건</span>
              <DiffLine today={pace.today} base={pace.yesterday} />
            </div>
            <div className="pace-row">
              <span className="pace-label">평상시 이시간</span>
              <span className="pace-track"><span className="pace-fill" style={{ width: bar(pace.usual) }} /></span>
              <span className="pace-num tnum">{fmt(pace.usual)}건</span>
              <DiffLine today={pace.today} base={pace.usual} />
            </div>
          </div>
          <p className="dash-sub" style={{ margin: "8px 0 0", fontSize: 12 }}>
            평상시 = 최근 {pace.usualDays}일 같은 시간대 평균 · 차이는 오늘 기준
          </p>
        </>
      )}
    </section>
  );
}
