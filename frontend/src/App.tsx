import { useEffect, useState } from "react";
import { getHealth, BASE_URL, type HealthResponse } from "./api/client";
import { useTheme, type Theme } from "./lib/useTheme";
import "./App.css";

type Status = "checking" | "ok" | "error";

const THEME_LABEL: Record<Theme, string> = {
  system: "🖥️ 시스템",
  light: "☀️ 라이트",
  dark: "🌙 다크",
};

/** 리드팟 로고 마크 (인디고 팟 + 그린 물방울) */
function LeadpotMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      className="mark"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <path
        d="M7 12h18l-1.6 12.2A3 3 0 0 1 20.4 27h-8.8a3 3 0 0 1-3-2.8L7 12Z"
        fill="var(--indigo)"
      />
      <path
        d="M16 3c2.6 3 4 5.2 4 7a4 4 0 1 1-8 0c0-1.8 1.4-4 4-7Z"
        fill="var(--green)"
      />
    </svg>
  );
}

function App() {
  const [status, setStatus] = useState<Status>("checking");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string>("");
  const { theme, toggle } = useTheme();

  async function check() {
    setStatus("checking");
    setError("");
    try {
      const data = await getHealth();
      setHealth(data);
      setStatus("ok");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  useEffect(() => {
    check();
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="wrap topbar-in">
          <div className="brand">
            <LeadpotMark />
            Leadpot
          </div>
          <button className="theme-btn" type="button" onClick={toggle}>
            {THEME_LABEL[theme]}
          </button>
        </div>
      </header>

      <main className="wrap hero-center">
        <p className="eyebrow">Phase 0 · 연결 확인</p>
        <h1 className="hero-title">
          흩어진 리드를 하나의 <span className="accent-green">팟</span>에 담다
        </h1>
        <p className="hero-lead">
          Leadpot은 랜딩페이지로 상담 DB(리드)를 모으고 관리하는 도구입니다.
        </p>
        <div className="tagpills">
          <span className="pill i">믿음직한</span>
          <span className="pill g">성과 중심</span>
          <span className="pill">쉽고 빠른</span>
        </div>

        <section className="card card-pad health-card">
          <div className="card-h">백엔드 연결 상태</div>
          <p className="api-url">
            API <code>{BASE_URL}</code>
          </p>

          {status === "checking" && <p className="status-checking">⏳ 확인 중…</p>}

          {status === "ok" && health && (
            <div className="status-ok">
              <p className="status-line">
                <span className="badge b-normal">정상</span> 연결 성공
              </p>
              <pre className="code-block">{JSON.stringify(health, null, 2)}</pre>
            </div>
          )}

          {status === "error" && (
            <div className="status-err">
              <p className="status-line">
                <span className="badge b-bad">실패</span> 연결 실패
              </p>
              <p className="err-msg">{error}</p>
              <p className="err-hint">
                백엔드(Spring Boot)가 실행 중인지 확인하세요 —{" "}
                <code>docker compose up -d</code> 또는{" "}
                <code>cd backend &amp;&amp; ./gradlew bootRun</code>
              </p>
            </div>
          )}

          <button className="btn btn-primary" onClick={check} style={{ marginTop: 16 }}>
            다시 확인
          </button>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap">
          Leadpot · 인디고 #3A43C0 / 그린 #12B886 · 라이트·다크 대응
        </div>
      </footer>
    </div>
  );
}

export default App;
