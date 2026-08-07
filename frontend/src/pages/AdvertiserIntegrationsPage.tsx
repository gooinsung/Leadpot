import { useEffect, useState } from "react";
import { Loading } from "../components/Loading";
import {
  ApiError,
  createAdvertiserCustomStatus,
  deleteAdvertiserCustomStatus,
  getAdvertiserIntegration,
  listAdvertiserCustomStatuses,
  listAdvertiserForms,
  testAdvertiserIntegration,
  updateAdvertiserCustomStatus,
  updateAdvertiserIntegration,
  updateAdvertiserNotifyPhone,
  type AdvertiserForm,
  type IntegrationSettings,
  type IntegrationTestResult,
  type LeadStatusOption,
} from "../api/client";
import { AdvertiserTopBar } from "../components/AdvertiserTopBar";

/**
 * 나만의 진행상태 관리(V29) — 상담중·부재중처럼 내 워크플로에 맞는 상태를 직접 만든다.
 *
 * 기본 4개(신규/유효/AS요청/무효)는 시스템 고정이라 여기 없다. 만든 상태는 담당 마케터
 * 화면에도 함께 보인다(공유 축). 쓰던 상태는 지우는 대신 <b>보관</b>한다 — 지우면 그 상태가
 * 붙은 리드의 표시가 사라지기 때문(서버가 사용 중 삭제를 막는다).
 */
function CustomStatusCard() {
  const [items, setItems] = useState<LeadStatusOption[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    listAdvertiserCustomStatuses().then(setItems).catch(() => setItems([]));
  }, []);

  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      await work();
      setItems(await listAdvertiserCustomStatuses());
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "처리에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card card-pad" style={{ marginBottom: 20 }}>
      <div className="card-h">진행상태 관리</div>
      <p className="dash-sub" style={{ marginTop: 0 }}>
        기본 상태(신규·유효·AS요청·무효) 외에 <b>나만의 상태</b>(상담중, 부재 3일차 등)를 만들어
        리드를 관리할 수 있습니다. 만든 상태는 담당 마케터에게도 함께 보입니다.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input
          className="input"
          style={{ flex: "1 1 200px", fontSize: 16 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="새 상태 이름 (예: 상담중)"
          maxLength={30}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) {
              e.preventDefault();
              run(async () => {
                await createAdvertiserCustomStatus(name.trim());
                setName("");
              });
            }
          }}
        />
        <button
          className="btn btn-primary"
          disabled={busy || !name.trim()}
          onClick={() =>
            run(async () => {
              await createAdvertiserCustomStatus(name.trim());
              setName("");
            })
          }
        >
          추가
        </button>
      </div>

      {items === null ? null : items.length === 0 ? (
        <p className="dash-sub" style={{ margin: 0 }}>아직 만든 상태가 없습니다.</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
          {items.map((s) => (
            <li key={s.key} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className={`pill ld-pill ld-CUSTOM`} style={{ opacity: s.archived ? 0.5 : 1 }}>
                {s.label}
              </span>
              {s.archived && <span className="dash-sub" style={{ fontSize: 12 }}>보관됨</span>}
              <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() => {
                    const next = window.prompt("새 이름", s.label);
                    if (next && next.trim() && next.trim() !== s.label) {
                      run(async () => {
                        await updateAdvertiserCustomStatus(s.customStatusId!, { name: next.trim() });
                      });
                    }
                  }}
                >
                  이름 변경
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await updateAdvertiserCustomStatus(s.customStatusId!, { archived: !s.archived });
                    })
                  }
                >
                  {s.archived ? "보관 해제" : "보관"}
                </button>
                <button
                  className="btn btn-ghost btn-sm danger"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`'${s.label}' 상태를 삭제할까요? 사용 중이면 삭제되지 않습니다.`)) return;
                    run(async () => {
                      await deleteAdvertiserCustomStatus(s.customStatusId!);
                    });
                  }}
                >
                  삭제
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {err && <p style={{ margin: "12px 0 0", color: "var(--danger, #e5484d)" }}>{err}</p>}
    </div>
  );
}

const EMPTY: IntegrationSettings = {
  telegramEnabled: false,
  telegramBotToken: "",
  telegramChatId: "",
};

/**
 * 리드폼별 접수 알림 수신번호 카드(V28).
 *
 * <b>광고주 본인이 자기 번호를 직접 등록한다.</b> 예전에는 마케터가 리드폼 편집에서 광고주 번호를
 * 대신 넣었는데, 번호 주인은 동의한 적도 끌 수도 없었다. 발신 채널이 리드팟 명의 하나라
 * 신고 한 번에 전 고객 알림이 막힌다(docs/MESSAGING-PLAN.md §9).
 * 여기서 번호를 넣는 행위 자체가 수신 동의 근거가 되고, 언제든 비워서 끌 수 있다.
 */
function NotifyPhoneCard() {
  const [forms, setForms] = useState<AdvertiserForm[] | null>(null);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    listAdvertiserForms()
      .then((list) => {
        setForms(list);
        setDraft(Object.fromEntries(list.map((f) => [f.formId, f.notifyPhone])));
      })
      .catch(() => {
        // 빈 목록으로 두면 "배정받은 리드폼이 없습니다"라고 거짓 안내를 하게 된다 — 사유를 밝힌다.
        setForms([]);
        setErr("리드폼 목록을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.");
      });
  }, []);

  async function save(formId: number) {
    setBusy(formId);
    setErr("");
    setDone(null);
    try {
      const updated = await updateAdvertiserNotifyPhone(formId, draft[formId] ?? "");
      setForms((prev) => (prev ?? []).map((f) => (f.formId === formId ? updated : f)));
      setDraft((prev) => ({ ...prev, [formId]: updated.notifyPhone }));
      setDone(formId);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "저장에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  }

  // 번호를 등록할 수 있는 건 마케터가 접수 알림을 켠 리드폼뿐이다. 다만 켠 폼이 없다고 카드를 통째로
  // 숨기면 안 된다 — 광고주는 "번호 넣는 곳이 아예 없다"만 보고 이유를 알 수 없다(2026-08-08 사용자 제보).
  // 마케터는 광고주가 등록하기를 기다리고 광고주는 입력란을 못 찾는 교착이 된다. 그래서 항상 렌더하고
  // 등록 불가한 리드폼은 사유와 함께 보여준다.
  if (forms === null) return null;
  const targets = forms.filter((f) => f.notifyEnabled);
  const blocked = forms.filter((f) => !f.notifyEnabled);

  return (
    <div className="card card-pad" style={{ marginBottom: 20 }}>
      <div className="card-h">접수 알림 문자 받기</div>
      <p className="dash-sub" style={{ marginTop: 0 }}>
        새 리드가 접수되면 <b>여기 등록한 내 번호</b>로 문자가 옵니다. 개인정보는 넣지 않고{" "}
        <b>접수 사실과 리드폼 이름만</b> 보냅니다. <b>번호를 비우고 저장하면 즉시 중단</b>됩니다.
      </p>

      {forms.length === 0 && !err && (
        <p className="dash-sub" style={{ marginBottom: 0 }}>
          아직 배정받은 리드폼이 없습니다. 담당 마케터가 리드폼을 배정하면 여기에 표시됩니다.
        </p>
      )}

      {targets.length > 0 && (
      <div style={{ display: "grid", gap: 14, maxWidth: 620, marginTop: 14 }}>
        {targets.map((f) => (
          <label className="field" key={f.formId}>
            <span className="field-label">{f.name}</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                className="input"
                style={{ flex: "1 1 200px", fontSize: 16 }}
                inputMode="tel"
                value={draft[f.formId] ?? ""}
                onChange={(e) => setDraft((p) => ({ ...p, [f.formId]: e.target.value }))}
                placeholder="비우면 알림을 받지 않습니다"
              />
              <button
                className="btn btn-primary"
                onClick={() => save(f.formId)}
                disabled={busy === f.formId || (draft[f.formId] ?? "") === f.notifyPhone}
              >
                {busy === f.formId ? "저장 중…" : done === f.formId ? "저장됨!" : "저장"}
              </button>
            </div>
            <span className="dash-sub" style={{ fontSize: 12, marginTop: 4 }}>
              {f.notifyPhone ? "현재 알림을 받는 중입니다." : "아직 등록 전이라 알림이 오지 않습니다."}
            </span>
          </label>
        ))}
      </div>
      )}

      {blocked.length > 0 && (
        <div style={{ marginTop: targets.length > 0 ? 20 : 14 }}>
          <p className="dash-sub" style={{ margin: 0 }}>
            아래 리드폼은 <b>담당 마케터가 접수 알림을 아직 켜지 않아</b> 번호를 등록할 수 없습니다.
            마케터에게 <b>리드폼 편집 → 옵션 → &lsquo;광고주에게 접수 알림 보내기&rsquo;</b>를 켜달라고 요청하세요.
          </p>
          <ul className="dash-sub" style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.8 }}>
            {blocked.map((f) => (
              <li key={f.formId}>{f.name}</li>
            ))}
          </ul>
        </div>
      )}

      {err && (
        <p style={{ margin: "12px 0 0", color: "var(--danger, #e5484d)" }}>{err}</p>
      )}
    </div>
  );
}

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
            <p className="eyebrow">설정</p>
            <h1 className="dash-title">알림 · 상태 관리</h1>
            <p className="dash-sub">
              접수 알림(문자·텔레그램) 수신과 나만의 진행상태를 여기서 관리합니다.
            </p>
          </div>
        </div>

        <CustomStatusCard />

        <NotifyPhoneCard />

        {loading ? (
          <Loading />
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
