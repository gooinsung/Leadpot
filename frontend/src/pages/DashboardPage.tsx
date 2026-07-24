import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, getHealth, leadsCount, listForms, updateSubdomain } from "../api/client";
import { useAuth } from "../lib/authContext";
import { TopBar } from "../components/TopBar";

type HealthState = "checking" | "ok" | "error";

/** 대시보드. 로그인한 본인 데이터만 표시(K5). */
export function DashboardPage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [health, setHealth] = useState<HealthState>("checking");
  const [totalLeads, setTotalLeads] = useState<number | null>(null);
  const [formCount, setFormCount] = useState<number | null>(null);

  // 서브도메인 편집
  const [sub, setSub] = useState("");
  const [savingSub, setSavingSub] = useState(false);
  const [subMsg, setSubMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    getHealth().then(() => setHealth("ok")).catch(() => setHealth("error"));
    leadsCount().then((r) => setTotalLeads(r.total)).catch(() => setTotalLeads(0));
    listForms().then((f) => setFormCount(f.length)).catch(() => setFormCount(0));
  }, []);

  useEffect(() => {
    setSub(user?.subdomain ?? "");
  }, [user?.subdomain]);

  const saveSubdomain = async () => {
    const value = sub.trim().toLowerCase();
    if (!value || value === user?.subdomain) return;
    setSavingSub(true);
    setSubMsg(null);
    try {
      const updated = await updateSubdomain(value);
      updateUser(updated);
      setSubMsg({ type: "ok", text: "서브도메인을 변경했습니다." });
    } catch (e) {
      setSubMsg({ type: "err", text: e instanceof ApiError ? e.message : "변경에 실패했습니다." });
    } finally {
      setSavingSub(false);
    }
  };

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

        <section className="card card-pad" style={{ marginBottom: 24 }}>
          <div className="card-h">계정 설정 · 서브도메인</div>
          <p className="dash-sub" style={{ marginTop: 4 }}>
            공개 페이지 주소에 쓰이는 내 서브도메인입니다. 소문자·숫자·하이픈 3~30자.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
            <input
              className="input"
              style={{ maxWidth: 220 }}
              value={sub}
              onChange={(e) => setSub(e.target.value)}
              placeholder="예: my-brand"
              spellCheck={false}
              autoCapitalize="none"
            />
            <button className="btn btn-primary" type="button" onClick={saveSubdomain} disabled={savingSub || !sub.trim() || sub.trim() === user?.subdomain}>
              {savingSub ? "저장 중…" : "변경"}
            </button>
          </div>
          {subMsg && (
            <p className={subMsg.type === "err" ? "auth-error" : "auth-ok"} style={{ marginTop: 8 }}>{subMsg.text}</p>
          )}
          <p className="dash-sub" style={{ marginTop: 12, fontSize: 13 }}>
            공개 URL 예시: <code>{(sub || user?.subdomain || "sub")}.lead-pot.com/{"{랜딩번호}"}</code>
            {" "}· 로컬 확인: <code>{(sub || user?.subdomain || "sub")}.localhost:5173/{"{랜딩번호}"}</code>
          </p>
        </section>

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
