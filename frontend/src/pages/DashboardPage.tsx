import { useEffect, useState } from "react";
import { getHealth } from "../api/client";
import { useAuth } from "../lib/authContext";
import { TopBar } from "../components/TopBar";

type HealthState = "checking" | "ok" | "error";

/** 대시보드 골격(Phase 1). 로그인한 본인 정보만 표시(K5). 폼/랜딩/리드는 이후 Phase 에서 채운다. */
export function DashboardPage() {
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthState>("checking");

  useEffect(() => {
    getHealth()
      .then(() => setHealth("ok"))
      .catch(() => setHealth("error"));
  }, []);

  const kpis = [
    { label: "총 리드", value: "0" },
    { label: "오늘 유입", value: "0" },
    { label: "폼", value: "0" },
    { label: "랜딩페이지", value: "0" },
  ];

  const upcoming = [
    { title: "스텝형 폼", desc: "단계별 선택형(대화형 퍼널) 폼", phase: "Phase 2B" },
    { title: "랜딩 빌더", desc: "이미지·텍스트 구성 + 폼 연결", phase: "Phase 3" },
    { title: "공개 페이지 & 수집", desc: "공개 URL로 리드 수집", phase: "Phase 4" },
    { title: "리드 관리 & CSV", desc: "목록·상태·내보내기", phase: "Phase 5" },
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
          {kpis.map((k) => (
            <div className="kpi card" key={k.label}>
              <div className="k-label">{k.label}</div>
              <div className="k-val">{k.value}</div>
            </div>
          ))}
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
