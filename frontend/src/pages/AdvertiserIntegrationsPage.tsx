import { useEffect, useState } from "react";
import {
  ApiError,
  getAdvertiserIntegration,
  testAdvertiserIntegration,
  updateAdvertiserIntegration,
  type IntegrationSettings,
  type IntegrationTestResult,
} from "../api/client";
import { AdvertiserTopBar } from "../components/AdvertiserTopBar";

const EMPTY: IntegrationSettings = {
  telegramEnabled: false,
  telegramBotToken: "",
  telegramChatId: "",
};

/**
 * 광고주 알림 설정 화면 `/client/integrations`.
 * 새 리드가 접수되면 이 채널로도 텔레그램 알림이 간다(마케터와 별개, 내 계정 채널).
 * 구글시트는 마케터 폼 설정이라 여기서 다루지 않는다.
 */
export function AdvertiserIntegrationsPage() {
  const [s, setS] = useState<IntegrationSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<IntegrationTestResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdvertiserIntegration()
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
      const r = await updateAdvertiserIntegration(s);
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
      const r = await testAdvertiserIntegration();
      setTestResult(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "테스트에 실패했습니다.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="app-shell">
      <AdvertiserTopBar />
      <main className="wrap dashboard client-wrap">
        <div className="dash-head">
          <div>
            <p className="eyebrow">알림 설정</p>
            <h1 className="dash-title">텔레그램 알림</h1>
            <p className="dash-sub">
              새 리드가 접수되면 여기 설정한 <b>내 텔레그램</b>으로 즉시 알림이 옵니다. 봇 토큰·채팅 ID 를 입력하고
              <b> 알림 받기</b>를 켠 뒤 저장하세요. 알림 메시지의 링크를 누르면 해당 리드로 바로 이동합니다.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="dash-sub">불러오는 중…</p>
        ) : (
          <>
            <div className="card card-pad" style={{ marginBottom: 20 }}>
              <div className="card-h" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={s.telegramEnabled}
                    onChange={(e) => set("telegramEnabled", e.target.checked)}
                  />
                  텔레그램 알림 받기
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
                    <b>알림 받기</b>가 켜져 있고 봇 토큰·채팅 ID 가 채워져야 테스트됩니다. 값 입력 후 <b>저장</b>하고 다시 시도하세요.
                  </p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                    {testResult.results.map((r) => (
                      <li key={r.channel}>
                        <b>텔레그램</b>:{" "}
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
              팁: 저장 후 <b>테스트 발송</b>으로 도착을 확인하세요. 알림은 리드 접수를 방해하지 않도록 백그라운드로 전송됩니다.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
