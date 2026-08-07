import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ApiError,
  getHealth,
  getInbox,
  getStats,
  leadsCount,
  listForms,
  listLandings,
  updateSubdomain,
  type InboxItem,
} from "../api/client";
import { useAuth } from "../lib/authContext";
import { TopBar } from "../components/TopBar";
import { leadStatusClass, leadStatusLabel, maskPhone, pickName, pickPhone, summarizeAnswers } from "../lib/leadDisplay";

type HealthState = "checking" | "ok" | "error";

/** 대시보드. 로그인한 본인 데이터만 표시(K5). */
export function DashboardPage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [health, setHealth] = useState<HealthState>("checking");
  // '신규 리드' = 오늘(KST) 접수된 리드 수(2026-08-08 사용자 요청 — 총 리드 카드를 교체).
  const [todayNewLeads, setTodayNewLeads] = useState<number | null>(null);
  const [formCount, setFormCount] = useState<number | null>(null);
  const [landingCount, setLandingCount] = useState<number | null>(null);
  const [todayVisits, setTodayVisits] = useState<number | null>(null);

  // 서브도메인 편집
  const [sub, setSub] = useState("");
  const [savingSub, setSavingSub] = useState(false);
  const [subMsg, setSubMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // "오늘 들어온 리드" 미리보기(리디자인 §5) — 인박스 API 재사용, 4행 + 인박스 링크.
  const [todayLeads, setTodayLeads] = useState<InboxItem[] | null>(null);
  const [statusNames, setStatusNames] = useState<Record<string, string>>({});

  useEffect(() => {
    getHealth().then(() => setHealth("ok")).catch(() => setHealth("error"));
    leadsCount().then((r) => setTodayNewLeads(r.todayNew)).catch(() => setTodayNewLeads(0));
    listForms().then((f) => setFormCount(f.length)).catch(() => setFormCount(0));
    listLandings().then((l) => setLandingCount(l.length)).catch(() => setLandingCount(0));
    // 오늘 유입(전체 접속 수) — 통계 API 를 오늘 범위로 조회
    const p = (n: number) => String(n).padStart(2, "0");
    const d = new Date();
    const today = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    getStats({ from: today, to: today })
      .then((s) => setTodayVisits(s.summary.totalVisits))
      .catch(() => setTodayVisits(0));
    getInbox({ from: today, to: today, size: 4 })
      .then((r) => {
        setTodayLeads(r.items);
        setStatusNames(r.counts.statusNames);
      })
      .catch(() => setTodayLeads([]));
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
          <div className="kpi card row-click" onClick={() => navigate("/leads")} title="오늘 접수된 리드">
            <div className="k-label">신규 리드</div>
            <div className="k-val">{num(todayNewLeads)}</div>
          </div>
          <div className="kpi card row-click" onClick={() => navigate("/stats")}>
            <div className="k-label">오늘 유입</div>
            <div className="k-val">{num(todayVisits)}</div>
          </div>
          <div className="kpi card row-click" onClick={() => navigate("/forms")}>
            <div className="k-label">리드폼</div>
            <div className="k-val">{num(formCount)}</div>
          </div>
          <div className="kpi card row-click" onClick={() => navigate("/landings")}>
            <div className="k-label">랜딩페이지</div>
            <div className="k-val">{num(landingCount)}</div>
          </div>
        </div>

        {/* 리디자인 §5: 빈 공간 회수 — 왼쪽 '오늘 들어온 리드' 미리보기, 오른쪽 서브도메인 카드 */}
        <div className="dash-cols">
          <section className="card card-pad">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span className="card-h" style={{ margin: 0 }}>오늘 들어온 리드</span>
              <Link to="/inbox" style={{ fontSize: 12.5, fontWeight: 700 }}>인박스에서 모두 보기 →</Link>
            </div>
            {todayLeads === null ? (
              <p className="dash-sub" style={{ margin: 0 }}>불러오는 중…</p>
            ) : todayLeads.length === 0 ? (
              <p className="dash-sub" style={{ margin: 0 }}>오늘 접수된 리드가 아직 없습니다.</p>
            ) : (
              todayLeads.map((l) => {
                const phone = pickPhone(l.answers);
                return (
                  <div key={l.id} className="dash-lead-row" onClick={() => navigate("/inbox")}>
                    <span className="dl-name">
                      {l.status === "NEW" && <span className="ir-dot" />}
                      <span className="dl-name-text">{pickName(l.answers)}</span>
                    </span>
                    <span className="dl-phone tnum">{phone ? maskPhone(phone) : "—"}</span>
                    <span className="dl-summary">{summarizeAnswers(l.answers, [pickName(l.answers), phone])}</span>
                    <span className={`pill ld-pill ld-${leadStatusClass(l.statusKey)} dl-st`}>
                      {leadStatusLabel(l.statusKey, statusNames)}
                    </span>
                    <span className="dl-time tnum">
                      {new Date(l.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })
            )}
          </section>

          <section className="card card-pad" style={{ alignSelf: "start" }}>
            <div className="card-h">계정 설정 · 서브도메인</div>
            <p className="dash-sub" style={{ marginTop: 4 }}>
              공개 페이지 주소에 쓰이는 내 서브도메인입니다. 소문자·숫자·하이픈 3~30자.
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
              <input
                className="input"
                style={{ flex: "1 1 160px" }}
                value={sub}
                onChange={(e) => setSub(e.target.value)}
                placeholder="예: my-brand"
                spellCheck={false}
                autoCapitalize="none"
                maxLength={30}
              />
              <button className="btn btn-primary" type="button" onClick={saveSubdomain} disabled={savingSub || !sub.trim() || sub.trim() === user?.subdomain}>
                {savingSub ? "저장 중…" : "변경"}
              </button>
            </div>
            {subMsg && (
              <p className={subMsg.type === "err" ? "auth-error" : "auth-ok"} style={{ marginTop: 8 }}>{subMsg.text}</p>
            )}
            <p className="dash-sub" style={{ marginTop: 12, fontSize: 13, overflowWrap: "anywhere", wordBreak: "break-all" }}>
              공개 URL 예시: <code>{(sub || user?.subdomain || "sub")}.lead-pot.com/{"{랜딩번호}"}</code>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
