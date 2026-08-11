import { useEffect, useState } from "react";
import { Loading } from "../components/Loading";
import {
  ApiError,
  getIntegrations,
  testIntegrations,
  updateIntegrations,
  type IntegrationSettings,
  type IntegrationTestResult,
} from "../api/client";
import { TopBar } from "../components/TopBar";

const EMPTY: IntegrationSettings = {
  telegramEnabled: false,
  telegramBotToken: "",
  telegramChatId: "",
};

export function IntegrationsPage() {
  const [s, setS] = useState<IntegrationSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<IntegrationTestResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getIntegrations()
      .then((r) => setS({ ...EMPTY, ...r }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof IntegrationSettings>(key: K, value: IntegrationSettings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function onSave() {
    setSaving(true);
    setError("");
    setTestResult(null);
    try {
      // sheetsServiceAccountEmail 은 서버가 내려주는 읽기 전용 값이라 되돌려 보내지 않는다.
      const r = await updateIntegrations({
        telegramEnabled: s.telegramEnabled,
        telegramBotToken: s.telegramBotToken,
        telegramChatId: s.telegramChatId,
      });
      setS({ ...EMPTY, ...r });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    setTesting(true);
    setError("");
    setTestResult(null);
    try {
      const r = await testIntegrations();
      setTestResult(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "테스트에 실패했습니다.");
    } finally {
      setTesting(false);
    }
  }

  function copyServiceAccount() {
    navigator.clipboard?.writeText(s.sheetsServiceAccountEmail || "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">알림 · 연동</p>
            <h1 className="dash-title">외부 연동</h1>
            <p className="dash-sub">
              <b>텔레그램 알림</b>은 계정에 한 번 설정하고, 리드폼별로 켜고 끕니다(리드폼 편집 &gt; 옵션). <b>구글시트</b>는 리드폼마다 다른 시트로 보낼 수 있어 <b>각 리드폼 편집 화면</b>에서 설정합니다. 아래는 구글시트 준비 방법 안내입니다.
            </p>
          </div>
        </div>

        {loading ? (
          <Loading />
        ) : (
          <>
            {/* 텔레그램 */}
            <div className="card card-pad" style={{ marginBottom: 20 }}>
              <div className="card-h" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={s.telegramEnabled}
                    onChange={(e) => set("telegramEnabled", e.target.checked)}
                  />
                  텔레그램 알림
                </label>
              </div>
              <div className="form-grid" style={{ display: "grid", gap: 12, maxWidth: 620 }}>
                <label className="field">
                  <span className="field-label">봇 토큰 (Bot Token)</span>
                  <input
                    className="input"
                    value={s.telegramBotToken}
                    onChange={(e) => set("telegramBotToken", e.target.value)}
                    placeholder="123456:ABC-DEF..."
                  />
                </label>
                <label className="field">
                  <span className="field-label">채팅 ID (Chat ID)</span>
                  <input
                    className="input"
                    value={s.telegramChatId}
                    onChange={(e) => set("telegramChatId", e.target.value)}
                    placeholder="예: 987654321 (개인) 또는 -1001234567890 (그룹)"
                  />
                </label>
              </div>
              <details style={{ marginTop: 12 }}>
                <summary className="dash-sub" style={{ cursor: "pointer" }}>토큰·채팅 ID 얻는 방법</summary>
                <ol className="dash-sub" style={{ marginTop: 8, lineHeight: 1.7, paddingLeft: 20 }}>
                  <li>텔레그램에서 <code>@BotFather</code> 검색 → <code>/newbot</code> 으로 봇 생성 → <b>봇 토큰</b> 복사.</li>
                  <li>만든 봇과 대화를 시작(개인 알림) 하거나, 봇을 그룹에 초대(그룹 알림).</li>
                  <li>
                    채팅 ID 확인: <code>@userinfobot</code> 에게 말을 걸면 개인 ID 확인. 그룹은 봇을 넣고
                    <code> https://api.telegram.org/bot&lt;토큰&gt;/getUpdates </code> 를 열어 <code>chat.id</code> 확인.
                  </li>
                </ol>
              </details>
            </div>

            {/* 구글시트 연동 방법(공통 안내) — 실제 시트 주소·탭은 각 리드폼 편집에서 입력 */}
            <div className="card card-pad" style={{ marginBottom: 20 }}>
              <div className="card-h">구글시트 연동 방법 (리드폼별 설정)</div>
              <p className="dash-sub" style={{ marginTop: 0 }}>
                아래 <b>서비스 계정 이메일을 시트 공유에 '편집자'로 추가</b>하기만 하면 됩니다.
                스크립트를 심거나 배포할 필요가 없습니다. 시트 주소는 <b>각 리드폼 편집 화면 &gt; 옵션 &gt; 구글시트</b>에 넣습니다.
              </p>

              {s.sheetsServiceAccountEmail ? (
                <div style={{ marginTop: 12 }}>
                  <span className="field-label">서비스 계정 이메일</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
                    <input
                      className="input"
                      readOnly
                      style={{ fontFamily: "var(--mono)", fontSize: 12.5, flex: 1, minWidth: 280 }}
                      value={s.sheetsServiceAccountEmail}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <button className="btn btn-ghost btn-sm" onClick={copyServiceAccount}>
                      {copied ? "복사됨!" : "복사"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="dash-sub" style={{ marginTop: 12, color: "var(--danger, #e5484d)" }}>
                  ⚠️ 서버에 구글 서비스 계정 키가 아직 설정되지 않았습니다. 설정 전에는 시트 전송이 동작하지 않습니다.
                </p>
              )}

              <ol className="dash-sub" style={{ marginTop: 12, lineHeight: 1.7, paddingLeft: 20 }}>
                <li>기록할 구글시트를 열고 오른쪽 위 <b>공유</b> 클릭.</li>
                <li>위 <b>서비스 계정 이메일</b>을 붙여넣고 권한을 <b>편집자</b>로 지정 → 보내기. (알림 메일 체크는 꺼도 됩니다)</li>
                <li>시트 <b>주소를 그대로 복사</b> → <b>리드폼 편집 &gt; 옵션 &gt; 구글시트</b> 칸에 붙여넣기 → 저장.</li>
                <li>같은 화면의 <b>시트 테스트 발송</b>으로 확인.</li>
              </ol>

              <p className="dash-sub" style={{ marginTop: 8, fontSize: 12 }}>
                시트에 기록되는 값은 <b>접수일시 · 리드폼 이름 · 리드폼에서 받은 답변</b>뿐입니다.
                IP·기기·유입경로(UTM) 같은 방문자 정보는 보내지 않습니다 — 필요하면 리드 목록의 내보내기를 쓰세요.
                <br />
                ⚠️ <b>예전 Apps Script 방식으로 연동해 둔 리드폼이 있다면</b> 위 절차로 다시 설정해야 합니다.
                웹앱 URL 방식은 더 이상 쓰지 않습니다(설정을 옮기기 전까지 그 리드폼은 시트에 쌓이지 않습니다).
                <br />
                ※ 광고주 회사가 <b>외부 사용자와 파일 공유 금지</b> 정책을 쓰면 서비스 계정 추가가 막힐 수 있습니다.
                그 경우 광고주 쪽 구글 관리자에게 예외를 요청해야 합니다.
              </p>
            </div>

            {error && (
              <div className="card card-pad" style={{ marginBottom: 16, borderColor: "var(--danger, #e5484d)" }}>
                <p style={{ margin: 0, color: "var(--danger, #e5484d)" }}>{error}</p>
              </div>
            )}

            {testResult && (
              <div className="card card-pad" style={{ marginBottom: 16 }}>
                <div className="card-h">테스트 결과</div>
                {testResult.results.length === 0 ? (
                  <p className="dash-sub" style={{ margin: 0 }}>
                    텔레그램이 켜져 있고 봇 토큰·채팅 ID 가 채워져야 테스트됩니다. 값 입력 후 <b>저장</b>하고 다시 시도하세요.
                  </p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                    {testResult.results.map((r) => (
                      <li key={r.channel}>
                        <b>{r.channel === "telegram" ? "텔레그램" : "구글시트"}</b>:{" "}
                        <span className={`badge ${r.ok ? "b-normal" : "b-bad"}`}>{r.ok ? "성공" : "실패"}</span>{" "}
                        <span className="dash-sub">{r.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="edit-actions" style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={onSave} disabled={saving}>
                {saving ? "저장 중…" : saved ? "저장됨!" : "저장"}
              </button>
              <button className="btn btn-ghost" onClick={onTest} disabled={testing}>
                {testing ? "테스트 중…" : "텔레그램 테스트 발송"}
              </button>
            </div>
            <p className="dash-sub" style={{ fontSize: 12, marginTop: 10 }}>
              팁: 텔레그램은 저장 후 <b>테스트 발송</b>으로 도착을 확인하세요. 구글시트 테스트는 각 리드폼 편집 화면에서 합니다. 알림은 리드 접수를 방해하지 않도록 백그라운드로 전송됩니다.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
