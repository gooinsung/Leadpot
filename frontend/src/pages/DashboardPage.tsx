import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getHealth, leadsCount, listForms } from "../api/client";
import { useAuth } from "../lib/authContext";
import { TopBar } from "../components/TopBar";

type HealthState = "checking" | "ok" | "error";

/** 대시보드. 로그인한 본인 데이터만 표시(K5). */
export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [health, setHealth] = useState<HealthState>("checking");
  const [totalLeads, setTotalLeads] = useState<number | null>(null);
  const [formCount, setFormCount] = useState<number | null>(null);

  useEffect(() => {
    getHealth().then(() => setHealth("ok")).catch(() => setHealth("error"));
    leadsCount().then((r) => setTotalLeads(r.total)).catch(() => setTotalLeads(0));
    listForms().then((f) => setFormCount(f.length)).catch(() => setFormCount(0));
  }, []);

  const num = (v: number | null) => (v == null ? "…" : v.toLocaleString("ko-KR"));

  const upcoming = [
    { title: "랜딩 빌더", desc: "이미지·텍스트 구성 + 폼 연결", phase: "Phase 3" },
    { title: "리드 상태·CSV", desc: "상담 상태 관리·엑셀 내보내기", phase: "Phase 5" },
    { title: "구글시트·알림 연동", desc: "접수 시 시트 전송·텔레그램/카톡 알림", phase: "추후" },
    { title: "통계", desc: "유입·전환·UTM 캠페인 분석", phase: "Phase 6" },
  ];

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">대시보드</p>
            <h1 className="dash-title">안녕하세요, {user?.name}님 👋</h1>
            <p className="dash-sub">
              {user?.plan} 플랜 · {user?.email}
            </p>
          </div>
          <span className={`badge ${health === "ok" ? "b-normal" : health === "error" ? "b-bad" : "b-wait"}`}>
            {health === "ok" ? "서버 정상" : health === "error" ? "서버 연결 실패" : "확인 중"}
          </span>
        </div>

        <div className="kpis">
          <div className="kpi card row-click" onClick={() => navigate("/forms")}>
            <div className="k-label">총 리드</div>
            <div className="k-val">{num(totalLeads)}</div>
          </div>
          <div className="kpi card">
            <div className="k-label">오늘 유입</div>
            <div className="k-val">-</div>
          </div>
          <div className="kpi card row-click" onClick={() => navigate("/forms")}>
            <div className="k-label">폼</div>
            <div className="k-val">{num(formCount)}</div>
          </div>
          <div className="kpi card">
            <div className="k-label">랜딩페이지</div>
            <div className="k-val">-</div>
          </div>
        </div>

        <section className="card card-pad upcoming">
          <div className="card-h">곧 추가될 기능</div>
          <div className="upcoming-grid">
            {upcoming.map((u) => (
              <div className="upcoming-item" key={u.title}>
                <div className="upcoming-top">
                  <span className="upcoming-title">{u.title}</span>
                  <span className="pill i">{u.phase}</span>
                </div>
                <p className="upcoming-desc">{u.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
