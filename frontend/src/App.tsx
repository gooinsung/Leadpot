import { useEffect, useState } from "react";
import { getHealth, BASE_URL, type HealthResponse } from "./api/client";
import "./App.css";

type Status = "checking" | "ok" | "error";

function App() {
  const [status, setStatus] = useState<Status>("checking");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string>("");

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
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 560, margin: "60px auto", padding: "0 20px" }}>
      <h1 style={{ marginBottom: 4 }}>Leadpot</h1>
      <p style={{ color: "#666", marginTop: 0 }}>랜딩페이지 리드 수집 서비스 · Phase 0 연결 확인</p>

      <section style={{ border: "1px solid #e2e2e2", borderRadius: 12, padding: 20, marginTop: 24 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>백엔드 연결 상태</h2>
        <p style={{ fontSize: 13, color: "#888" }}>API: {BASE_URL}</p>

        {status === "checking" && <p>⏳ 확인 중…</p>}
        {status === "ok" && health && (
          <div style={{ color: "#0a7d28" }}>
            <p style={{ fontWeight: 600 }}>✅ 연결 성공</p>
            <pre style={{ background: "#f6f8fa", padding: 12, borderRadius: 8, fontSize: 13 }}>
              {JSON.stringify(health, null, 2)}
            </pre>
          </div>
        )}
        {status === "error" && (
          <div style={{ color: "#c0392b" }}>
            <p style={{ fontWeight: 600 }}>❌ 연결 실패</p>
            <p style={{ fontSize: 13 }}>{error}</p>
            <p style={{ fontSize: 12, color: "#888" }}>백엔드(Spring Boot)가 실행 중인지 확인하세요.</p>
          </div>
        )}

        <button onClick={check} style={{ marginTop: 8, padding: "8px 16px", borderRadius: 8, border: "1px solid #ccc", cursor: "pointer" }}>
          다시 확인
        </button>
      </section>
    </main>
  );
}

export default App;
