import { useCallback, useEffect, useState } from "react";
import { getFormPace, getLeadPace, type FormPace, type LeadPace } from "../api/client";
import { FormPaceCard } from "../components/FormPaceCard";
import { LeadPaceCard } from "../components/LeadPaceCard";
import { TopBar } from "../components/TopBar";

/**
 * '오늘 추이' 페이지(/trend, 2026-11-05 사용자 요청) — 오늘 접수가 어제·최근 7일과 비교해 어떤지 한 화면에서.
 * 위: 계정 전체 '접수 페이스' / 아래: 리드폼별 표(전체 + 검색·정렬). 열어둔 채로 보도록 5분마다 자동 새로고침.
 */

const AUTO_REFRESH_MS = 5 * 60 * 1000;

export function TrendPage() {
  const [pace, setPace] = useState<LeadPace | null | "error">(null);
  const [formPace, setFormPace] = useState<FormPace | null | "error">(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      getLeadPace().then(setPace).catch(() => setPace("error")),
      getFormPace().then(setFormPace).catch(() => setFormPace("error")),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, AUTO_REFRESH_MS);
    return () => window.clearInterval(t);
  }, [load]);

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">통계</p>
            <h1 className="dash-title">오늘 추이</h1>
            <p className="dash-sub">오늘 접수가 어제 · 최근 7일 같은 시간대보다 얼마나 많은지/적은지 — 5분마다 자동 새로고침</p>
          </div>
          <div className="edit-actions">
            <button className="btn btn-ghost" onClick={load} disabled={loading}>
              {loading ? "불러오는 중…" : "새로고침"}
            </button>
          </div>
        </div>

        <LeadPaceCard pace={pace} />
        <FormPaceCard data={formPace} mode="full" />
      </main>
    </div>
  );
}
