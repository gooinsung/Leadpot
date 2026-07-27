import { useEffect, useState } from "react";
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
  sheetsEnabled: false,
  sheetsWebhookUrl: "",
};

// 사용자가 구글시트에 붙여넣을 Apps Script 코드(웹훅 수신 → 행 추가).
const APPS_SCRIPT = `function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var answers = data.answers || {};
  var keys = Object.keys(answers);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['접수일시', '리드폼', '상태', '중복'].concat(keys));
  }
  var row = [data.createdAt, data.formName, data.status, data.duplicate ? 'Y' : 'N']
    .concat(keys.map(function (k) { return answers[k]; }));
  sheet.appendRow(row);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}`;

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
      const r = await updateIntegrations(s);
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

  function copyScript() {
    navigator.clipboard?.writeText(APPS_SCRIPT).then(() => {
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
              새 리드가 접수되면 텔레그램으로 알림을 받고, 구글시트에 자동으로 기록할 수 있습니다. 리드폼별로 알림 on/off 는 각 리드폼 편집에서 설정합니다.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="dash-sub">불러오는 중…</p>
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

            {/* 구글시트 */}
            <div className="card card-pad" style={{ marginBottom: 20 }}>
              <div className="card-h" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={s.sheetsEnabled}
                    onChange={(e) => set("sheetsEnabled", e.target.checked)}
                  />
                  구글시트 자동 기록
                </label>
              </div>
              <label className="field" style={{ maxWidth: 620, display: "block" }}>
                <span className="field-label">Apps Script 웹앱 URL</span>
                <input
                  className="input"
                  value={s.sheetsWebhookUrl}
                  onChange={(e) => set("sheetsWebhookUrl", e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                />
              </label>
              <details style={{ marginTop: 12 }} open>
                <summary className="dash-sub" style={{ cursor: "pointer" }}>연결 방법 (OAuth 불필요·무료)</summary>
                <ol className="dash-sub" style={{ marginTop: 8, lineHeight: 1.7, paddingLeft: 20 }}>
                  <li>구글시트 새로 만들기 → 상단 메뉴 <b>확장 프로그램 → Apps Script</b>.</li>
                  <li>아래 코드를 붙여넣고 저장.</li>
                  <li><b>배포 → 새 배포 → 유형: 웹 앱</b>, 실행 계정=<b>나</b>, 액세스=<b>모든 사용자</b> 로 배포.</li>
                  <li>발급된 <b>웹 앱 URL</b>(끝이 <code>/exec</code>)을 위 칸에 붙여넣기 → 저장 → 테스트.</li>
                </ol>
                <div style={{ position: "relative", marginTop: 8 }}>
                  <textarea
                    className="input"
                    readOnly
                    rows={12}
                    style={{ fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.5 }}
                    value={APPS_SCRIPT}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={copyScript}>
                    {copied ? "복사됨!" : "코드 복사"}
                  </button>
                </div>
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
                    켜져 있고 값이 채워진 채널이 없습니다. 값 입력 후 <b>저장</b>하고 다시 테스트하세요.
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
                {testing ? "테스트 중…" : "테스트 발송"}
              </button>
            </div>
            <p className="dash-sub" style={{ fontSize: 12, marginTop: 10 }}>
              팁: 값을 저장한 뒤 <b>테스트 발송</b>으로 실제 도착 여부를 확인하세요. 알림은 리드 접수를 방해하지 않도록 백그라운드로 전송됩니다.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
