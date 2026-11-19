import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loading } from "../components/Loading";
import { TopBar } from "../components/TopBar";
import { toast } from "../lib/toast";
import {
  ApiError,
  createAdConnection,
  createAdRule,
  deleteAdConnection,
  deleteAdRule,
  getAdCatalog,
  listAdAccounts,
  listAdActionLogs,
  listAdCampaigns,
  listAdConnections,
  listAdRules,
  listForms,
  setAdCampaignStatus,
  setAdRuleEnabled,
  updateAdConnection,
  updateAdRule,
  type AdAccountItem,
  type AdActionLogItem,
  type AdCampaignItem,
  type AdCatalog,
  type AdConnection,
  type AdRule,
  type AdRuleInput,
  type AdRuleTarget,
  type FormSummary,
} from "../api/client";

/**
 * 광고 연동(docs/AD-AUTOMATION-PLAN.md) — 매체 연결 · 캠페인 수동 켜기/끄기 · 자동화 규칙(조건 → 동작) · 실행 이력.
 * 매체·입력 칸·조건·동작 종류는 서버 카탈로그를 따른다(매체가 늘어도 이 화면은 그대로).
 */
type Tab = "connections" | "campaigns" | "rules" | "logs";
const TABS: [Tab, string][] = [
  ["connections", "매체 연결"],
  ["campaigns", "캠페인"],
  ["rules", "자동화 규칙"],
  ["logs", "실행 이력"],
];

/** 매체별 연동 안내 페이지(있는 매체만). */
const GUIDE_LINKS: Record<string, string> = {
  KARROT: "/ad-automation/guide/karrot",
};

function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

export function AdAutomationPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find(([t]) => t === params.get("tab"))?.[0] ?? "connections") as Tab;
  const [catalog, setCatalog] = useState<AdCatalog | null>(null);
  const [connections, setConnections] = useState<AdConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const reloadConnections = useCallback(() => listAdConnections().then(setConnections).catch(() => {}), []);

  useEffect(() => {
    Promise.all([getAdCatalog().then(setCatalog), reloadConnections()])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reloadConnections]);

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">운영 · 광고 매체</p>
            <h1 className="dash-title">광고 연동</h1>
            <p className="dash-sub">
              내 광고 계정을 연결해 두면 <b>조건</b>(예: 리드폼에 오늘 5건)을 만족했을 때 리드팟이 <b>동작</b>(캠페인 끄기)을
              대신 실행합니다. 매체 연동은 편의 기능이라, 매체가 응답하지 않아도 <b>리드 접수에는 아무 영향이 없습니다</b>.
            </p>
          </div>
        </div>

        {catalog && !catalog.enabled && (
          <div className="card card-pad ads-warn" style={{ marginBottom: 16 }}>
            광고 연동 기능이 운영자에 의해 잠시 꺼져 있습니다. 자동화 규칙과 수동 켜기/끄기가 동작하지 않습니다.
          </div>
        )}
        {catalog && !catalog.encryptionReady && (
          <div className="card card-pad ads-warn" style={{ marginBottom: 16 }}>
            서버에 암호화 키가 설정되지 않아 매체를 연결할 수 없습니다. 운영자에게 문의해주세요.
          </div>
        )}

        <div className="seg ads-tabs" role="tablist">
          {TABS.map(([t, label]) => (
            <button key={t} type="button" role="tab" className={tab === t ? "on" : ""} onClick={() => setParams({ tab: t })}>
              {label}
            </button>
          ))}
        </div>

        {loading || !catalog ? (
          <Loading />
        ) : tab === "connections" ? (
          <ConnectionsTab catalog={catalog} connections={connections} reload={reloadConnections} />
        ) : tab === "campaigns" ? (
          <CampaignsTab connections={connections} />
        ) : tab === "rules" ? (
          <RulesTab catalog={catalog} connections={connections} />
        ) : (
          <LogsTab />
        )}
      </main>
    </div>
  );
}

// ======================= 매체 연결 =======================

function ConnectionsTab({
  catalog,
  connections,
  reload,
}: {
  catalog: AdCatalog;
  connections: AdConnection[];
  reload: () => Promise<void>;
}) {
  const supported = catalog.platforms.filter((p) => p.supported);
  const [platform, setPlatform] = useState(supported[0]?.platform ?? "");
  const [label, setLabel] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  const info = catalog.platforms.find((p) => p.platform === platform);

  async function onCreate() {
    setSaving(true);
    try {
      await createAdConnection({ platform, label, credentials: values });
      toast.success("연결했습니다.");
      setLabel("");
      setValues({});
      await reload();
    } catch (e) {
      toast.error(errMsg(e, "연결에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(c: AdConnection) {
    if (!window.confirm(`'${c.label}' 연결을 삭제할까요?\n이 연결을 쓰는 자동화 규칙은 삭제되지 않고 일시정지됩니다.`)) return;
    try {
      await deleteAdConnection(c.id);
      toast.success("삭제했습니다.");
      await reload();
    } catch (e) {
      toast.error(errMsg(e, "삭제에 실패했습니다."));
    }
  }

  return (
    <>
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="card-h">연결된 매체</div>
        {connections.length === 0 ? (
          <p className="ads-muted">아직 연결한 매체가 없습니다. 아래에서 연결해주세요.</p>
        ) : (
          <div className="card card-table">
            <table>
              <thead>
                <tr>
                  <th>매체</th>
                  <th>이름</th>
                  <th>계정 · 키</th>
                  <th>상태</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {connections.map((c) => (
                  <tr key={c.id}>
                    <td>{c.platformLabel}</td>
                    <td>{c.label}</td>
                    <td className="ads-muted">{c.credentialsHint ?? "-"}</td>
                    <td>
                      {c.status === "ACTIVE" ? (
                        <span className="badge b-normal">정상</span>
                      ) : (
                        <span className="badge b-bad" title={c.statusMessage ?? ""}>
                          다시 연결 필요
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="ads-row">
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(editing === c.id ? null : c.id)}>
                          키 교체
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => onDelete(c)}>
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {connections
          .filter((c) => c.status === "INVALID" && c.statusMessage)
          .map((c) => (
            <p key={c.id} className="ads-paused">
              {c.label}: {c.statusMessage}
            </p>
          ))}
        {editing != null && (
          <ReplaceCredentials
            catalog={catalog}
            connection={connections.find((c) => c.id === editing)!}
            onDone={async () => {
              setEditing(null);
              await reload();
            }}
          />
        )}
      </div>

      <div className="card card-pad">
        <div className="card-h">새 매체 연결</div>
        <div className="ads-grid">
          <label className="field">
            <span className="field-label">매체</span>
            <select
              className="input"
              value={platform}
              onChange={(e) => {
                setPlatform(e.target.value);
                setValues({});
              }}
            >
              {catalog.platforms.map((p) => (
                <option key={p.platform} value={p.platform} disabled={!p.supported}>
                  {p.label}
                  {p.supported ? "" : " (준비 중)"}
                </option>
              ))}
            </select>
            {GUIDE_LINKS[platform] && (
              <span className="ads-help">
                처음이라면 <Link to={GUIDE_LINKS[platform]}>{info?.label} 연동 안내</Link>를 먼저 봐주세요.
              </span>
            )}
          </label>
          <label className="field">
            <span className="field-label">이름(선택)</span>
            <input
              className="input"
              value={label}
              maxLength={100}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="예: OO치과 당근"
            />
          </label>
          {info?.fields.map((f) => (
            <label key={f.key} className="field">
              <span className="field-label">{f.label}</span>
              <input
                className="input"
                type={f.secret ? "password" : "text"}
                autoComplete="off"
                value={values[f.key] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
              {f.help && <span className="ads-help">{f.help}</span>}
            </label>
          ))}
          <div>
            <button className="btn btn-primary" disabled={saving || !info?.supported} onClick={onCreate}>
              {saving ? "연결 확인 중…" : "연결 확인 후 저장"}
            </button>
            <p className="ads-help">저장 전에 매체에 실제로 접속해 키가 맞는지 확인합니다. 키는 암호화해 보관하고 다시 보여주지 않습니다.</p>
          </div>
        </div>
      </div>
    </>
  );
}

function ReplaceCredentials({
  catalog,
  connection,
  onDone,
}: {
  catalog: AdCatalog;
  connection: AdConnection;
  onDone: () => Promise<void>;
}) {
  const info = catalog.platforms.find((p) => p.platform === connection.platform);
  const [label, setLabel] = useState(connection.label);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function onSave() {
    setSaving(true);
    try {
      const filled = Object.values(values).some((v) => v.trim());
      await updateAdConnection(connection.id, { label, credentials: filled ? values : undefined });
      toast.success("저장했습니다.");
      await onDone();
    } catch (e) {
      toast.error(errMsg(e, "저장에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ads-picker" style={{ marginTop: 14 }}>
      <div className="ads-grid">
        <b>'{connection.label}' 이름·키 바꾸기</b>
        <label className="field">
          <span className="field-label">이름</span>
          <input className="input" value={label} maxLength={100} onChange={(e) => setLabel(e.target.value)} />
        </label>
        {info?.fields.map((f) => (
          <label key={f.key} className="field">
            <span className="field-label">{f.label}</span>
            <input
              className="input"
              type={f.secret ? "password" : "text"}
              autoComplete="off"
              value={values[f.key] ?? ""}
              placeholder="바꿀 때만 입력"
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </label>
        ))}
        <p className="ads-help">키를 바꾸려면 모든 칸을 다시 입력하세요. 이름만 바꾸려면 키 칸을 비워두면 됩니다.</p>
        <div className="ads-row">
          <button className="btn btn-primary btn-sm" disabled={saving} onClick={onSave}>
            {saving ? "확인 중…" : "저장"}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => onDone()}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

// ======================= 캠페인(수동 켜기/끄기) =======================

/** 연결 → 광고계정 선택 + 캠페인 목록 조회(캠페인 탭·규칙 대상 고르기 공용). */
function useCampaignBrowser(connections: AdConnection[]) {
  const [connectionId, setConnectionId] = useState<number | null>(connections[0]?.id ?? null);
  const [accounts, setAccounts] = useState<AdAccountItem[]>([]);
  const [accountId, setAccountId] = useState("");
  const [campaigns, setCampaigns] = useState<AdCampaignItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setAccounts([]);
    setAccountId("");
    setCampaigns([]);
    setError("");
    if (connectionId == null) return;
    setLoading(true);
    listAdAccounts(connectionId)
      .then((a) => {
        setAccounts(a);
        setAccountId(a[0]?.id ?? "");
      })
      .catch((e) => setError(errMsg(e, "광고계정을 불러오지 못했습니다.")))
      .finally(() => setLoading(false));
  }, [connectionId]);

  const loadCampaigns = useCallback(() => {
    if (connectionId == null || !accountId) return Promise.resolve();
    setLoading(true);
    setError("");
    return listAdCampaigns(connectionId, accountId)
      .then(setCampaigns)
      .catch((e) => setError(errMsg(e, "캠페인을 불러오지 못했습니다.")))
      .finally(() => setLoading(false));
  }, [connectionId, accountId]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const selector = (
    <div className="ads-row">
      <select
        className="input"
        style={{ maxWidth: 260 }}
        value={connectionId ?? ""}
        onChange={(e) => setConnectionId(e.target.value ? Number(e.target.value) : null)}
      >
        {connections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.platformLabel} · {c.label}
          </option>
        ))}
      </select>
      {accounts.length > 1 && (
        <select className="input" style={{ maxWidth: 260 }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      )}
      <button className="btn btn-ghost btn-sm" onClick={() => void loadCampaigns()} disabled={loading}>
        새로고침
      </button>
    </div>
  );

  return { connectionId, accountId, campaigns, loading, error, selector, loadCampaigns };
}

function CampaignsTab({ connections }: { connections: AdConnection[] }) {
  const b = useCampaignBrowser(connections);
  const [busy, setBusy] = useState<string | null>(null);

  if (connections.length === 0) {
    return (
      <div className="card card-pad">
        <p className="ads-muted">먼저 '매체 연결' 탭에서 광고 계정을 연결해주세요.</p>
      </div>
    );
  }

  async function toggle(c: AdCampaignItem) {
    const next = !c.active;
    if (!window.confirm(`'${c.name}' 캠페인을 ${next ? "켤" : "끌"}까요?`)) return;
    setBusy(c.id);
    try {
      const r = await setAdCampaignStatus(b.connectionId!, c.id, {
        accountId: b.accountId,
        campaignName: c.name,
        active: next,
      });
      if (r.success) toast.success(next ? "켰습니다. 매체 반영까지 몇 분 걸릴 수 있어요." : "껐습니다. 매체 반영까지 몇 분 걸릴 수 있어요.");
      else toast.error(r.message ?? "실패했습니다.");
      await b.loadCampaigns();
    } catch (e) {
      toast.error(errMsg(e, "실패했습니다."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card card-pad">
      <div className="card-h">캠페인 켜기 · 끄기</div>
      {b.selector}
      {b.error && <p className="ads-paused">{b.error}</p>}
      {b.loading ? (
        <Loading />
      ) : b.campaigns.length === 0 ? (
        <p className="ads-muted" style={{ marginTop: 12 }}>
          캠페인이 없습니다.
        </p>
      ) : (
        <div className="card card-table" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>캠페인</th>
                <th>상태</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {b.campaigns.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>
                    <span className={`badge ${c.active ? "b-normal" : "b-wait"}`}>{c.statusLabel}</span>
                  </td>
                  <td>
                    {!c.readOnly && (
                      <button className="btn btn-ghost btn-sm" disabled={busy === c.id} onClick={() => toggle(c)}>
                        {busy === c.id ? "처리 중…" : c.active ? "끄기" : "켜기"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ======================= 자동화 규칙 =======================

/** 조건 종류별 설정 입력 칸. 새 조건을 추가하면 여기에 하나 더한다(없으면 설정 없는 조건). */
const CONDITION_FIELDS: Record<
  string,
  (cfg: Record<string, unknown>, set: (cfg: Record<string, unknown>) => void) => ReactElement
> = {
  DAILY_LEAD_COUNT: (cfg, set) => (
    <label className="field">
      <span className="field-label">하루 수량(건)</span>
      <input
        className="input"
        type="number"
        inputMode="numeric"
        min={1}
        style={{ maxWidth: 160 }}
        value={String(cfg.limit ?? "")}
        onChange={(e) => set({ ...cfg, limit: e.target.value === "" ? "" : Number(e.target.value) })}
      />
      <span className="ads-help">한국 시간 자정부터 센 오늘 리드 수(휴지통 제외)가 이 값에 도달하면 하루 한 번 동작합니다.</span>
    </label>
  ),
};

function emptyRule(catalog: AdCatalog): AdRuleInput {
  return {
    name: "",
    formId: 0,
    enabled: true,
    conditionType: catalog.conditions[0]?.type ?? "",
    conditionConfig: { limit: 5 },
    actionType: catalog.actions[0]?.type ?? "",
    actionConfig: {},
    notifySuccess: true,
    targets: [],
  };
}

function RulesTab({ catalog, connections }: { catalog: AdCatalog; connections: AdConnection[] }) {
  const [rules, setRules] = useState<AdRule[]>([]);
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id: number | null; input: AdRuleInput } | null>(null);

  const reload = useCallback(() => listAdRules().then(setRules).catch(() => {}), []);

  useEffect(() => {
    Promise.all([reload(), listForms().then(setForms)])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reload]);

  async function onToggle(r: AdRule) {
    try {
      await setAdRuleEnabled(r.id, !r.enabled);
      await reload();
    } catch (e) {
      toast.error(errMsg(e, "변경에 실패했습니다."));
    }
  }

  async function onDelete(r: AdRule) {
    if (!window.confirm(`'${r.name}' 규칙을 삭제할까요?`)) return;
    try {
      await deleteAdRule(r.id);
      toast.success("삭제했습니다.");
      await reload();
    } catch (e) {
      toast.error(errMsg(e, "삭제에 실패했습니다."));
    }
  }

  if (loading) return <Loading />;

  if (editing) {
    return (
      <RuleEditor
        catalog={catalog}
        connections={connections}
        forms={forms}
        initial={editing.input}
        ruleId={editing.id}
        onDone={async () => {
          setEditing(null);
          await reload();
        }}
      />
    );
  }

  return (
    <>
      <div className="ads-row" style={{ marginBottom: 14 }}>
        <button
          className="btn btn-primary"
          disabled={connections.length === 0}
          onClick={() => setEditing({ id: null, input: emptyRule(catalog) })}
        >
          + 규칙 만들기
        </button>
        {connections.length === 0 && <span className="ads-muted">먼저 매체를 연결해주세요.</span>}
      </div>
      {rules.length === 0 ? (
        <div className="card card-pad">
          <p className="ads-muted">아직 규칙이 없습니다. 예: "리드폼 A 에 오늘 5건이 들어오면 당근 캠페인 끄기"</p>
        </div>
      ) : (
        rules.map((r) => (
          <div key={r.id} className="card card-pad ads-rule">
            <div className="ads-rule-head">
              <div className="ads-row">
                <span className="ads-rule-name">{r.name}</span>
                {r.pausedReason ? (
                  <span className="badge b-bad">일시정지</span>
                ) : r.enabled ? (
                  <span className="badge b-normal">켜짐</span>
                ) : (
                  <span className="badge b-wait">꺼짐</span>
                )}
              </div>
              <div className="ads-row">
                <button className="btn btn-ghost btn-sm" onClick={() => onToggle(r)}>
                  {r.enabled ? "규칙 끄기" : "규칙 켜기"}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    setEditing({
                      id: r.id,
                      input: {
                        name: r.name,
                        formId: r.formName ? r.formId : 0,
                        enabled: r.enabled,
                        conditionType: r.conditionType,
                        conditionConfig: r.conditionConfig,
                        actionType: r.actionType,
                        actionConfig: {},
                        notifySuccess: r.notifySuccess,
                        targets: r.targets,
                      },
                    })
                  }
                >
                  수정
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => onDelete(r)}>
                  삭제
                </button>
              </div>
            </div>
            <div className="ads-rule-flow">
              리드폼 <b>{r.formName ?? "(삭제됨)"}</b> · <b>{r.conditionText}</b> → <b>{r.actionLabel}</b>
            </div>
            <ul className="ads-targets">
              {r.targets.map((t) => (
                <li key={`${t.connectionId}-${t.campaignId}`}>
                  {t.connectionLabel ?? "?"} · {t.campaignName}
                </li>
              ))}
            </ul>
            <div className="ads-help">
              마지막 발동: {r.lastFiredAt ? fmt(r.lastFiredAt) : "아직 없음"} · 성공 알림 {r.notifySuccess ? "켬" : "끔"}
            </div>
            {r.pausedReason && <div className="ads-paused">⚠️ {r.pausedReason}</div>}
          </div>
        ))
      )}
    </>
  );
}

function RuleEditor({
  catalog,
  connections,
  forms,
  initial,
  ruleId,
  onDone,
}: {
  catalog: AdCatalog;
  connections: AdConnection[];
  forms: FormSummary[];
  initial: AdRuleInput;
  ruleId: number | null;
  onDone: () => Promise<void>;
}) {
  const [input, setInput] = useState<AdRuleInput>(initial);
  const [saving, setSaving] = useState(false);
  const browser = useCampaignBrowser(connections);
  const conn = connections.find((c) => c.id === browser.connectionId);

  const selectedKeys = useMemo(
    () => new Set(input.targets.map((t) => `${t.connectionId}|${t.accountId}|${t.campaignId}`)),
    [input.targets],
  );

  function set<K extends keyof AdRuleInput>(key: K, value: AdRuleInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTarget(c: AdCampaignItem) {
    const t: AdRuleTarget = {
      connectionId: browser.connectionId!,
      connectionLabel: conn?.label,
      platform: conn?.platform,
      accountId: browser.accountId,
      campaignId: c.id,
      campaignName: c.name,
    };
    const key = `${t.connectionId}|${t.accountId}|${t.campaignId}`;
    set(
      "targets",
      selectedKeys.has(key)
        ? input.targets.filter((x) => `${x.connectionId}|${x.accountId}|${x.campaignId}` !== key)
        : [...input.targets, t],
    );
  }

  async function onSave() {
    setSaving(true);
    try {
      if (ruleId == null) await createAdRule(input);
      else await updateAdRule(ruleId, input);
      toast.success("저장했습니다.");
      await onDone();
    } catch (e) {
      toast.error(errMsg(e, "저장에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  const conditionField = CONDITION_FIELDS[input.conditionType];

  return (
    <div className="card card-pad">
      <div className="card-h">{ruleId == null ? "새 규칙" : "규칙 수정"}</div>
      <div className="ads-grid">
        <label className="field">
          <span className="field-label">규칙 이름</span>
          <input
            className="input"
            value={input.name}
            maxLength={100}
            onChange={(e) => set("name", e.target.value)}
            placeholder="예: 치과 상담 하루 5건 마감"
          />
        </label>
        <label className="field">
          <span className="field-label">리드폼</span>
          <select className="input" value={input.formId || ""} onChange={(e) => set("formId", Number(e.target.value))}>
            <option value="">리드폼 선택</option>
            {forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">조건</span>
          <select
            className="input"
            value={input.conditionType}
            onChange={(e) => {
              set("conditionType", e.target.value);
              set("conditionConfig", {});
            }}
          >
            {catalog.conditions.map((c) => (
              <option key={c.type} value={c.type}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {conditionField?.(input.conditionConfig, (cfg) => set("conditionConfig", cfg))}

        <label className="field">
          <span className="field-label">동작</span>
          <select className="input" value={input.actionType} onChange={(e) => set("actionType", e.target.value)}>
            {catalog.actions.map((a) => (
              <option key={a.type} value={a.type}>
                {a.label}
              </option>
            ))}
          </select>
          <span className="ads-help">끈 캠페인은 자동으로 다시 켜지 않습니다. 필요하면 '캠페인' 탭이나 매체에서 직접 켜주세요.</span>
        </label>

        <div className="field">
          <span className="field-label">대상 캠페인 ({input.targets.length}개 선택)</span>
          {input.targets.length > 0 && (
            <ul className="ads-targets" style={{ marginBottom: 8 }}>
              {input.targets.map((t) => (
                <li key={`${t.connectionId}-${t.campaignId}`}>
                  {t.connectionLabel ?? connections.find((c) => c.id === t.connectionId)?.label ?? "?"} · {t.campaignName}{" "}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => set("targets", input.targets.filter((x) => x !== t))}
                  >
                    빼기
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="ads-picker">
            {browser.selector}
            {browser.error && <p className="ads-paused">{browser.error}</p>}
            {browser.loading ? (
              <Loading />
            ) : (
              <div className="ads-campaigns">
                {browser.campaigns.length === 0 && <p className="ads-muted">캠페인이 없습니다.</p>}
                {browser.campaigns.map((c) => (
                  <label key={c.id} style={c.readOnly ? { opacity: 0.5 } : undefined}>
                    <input
                      type="checkbox"
                      disabled={c.readOnly}
                      checked={selectedKeys.has(`${browser.connectionId}|${browser.accountId}|${c.id}`)}
                      onChange={() => toggleTarget(c)}
                    />
                    {c.name} <span className="ads-muted">· {c.statusLabel}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <span className="ads-help">여러 매체의 캠페인을 함께 고를 수 있습니다(위에서 연결을 바꿔가며 선택).</span>
        </div>

        <label className="ads-check">
          <input type="checkbox" checked={input.notifySuccess} onChange={(e) => set("notifySuccess", e.target.checked)} />
          <span>성공했을 때도 텔레그램으로 알림(실패는 항상 알림 — '연동' 메뉴의 텔레그램 설정 사용)</span>
        </label>
        <label className="ads-check">
          <input type="checkbox" checked={input.enabled} onChange={(e) => set("enabled", e.target.checked)} />
          <span>규칙 켜기</span>
        </label>

        <div className="ads-row">
          <button className="btn btn-primary" disabled={saving} onClick={onSave}>
            {saving ? "저장 중…" : "저장"}
          </button>
          <button className="btn btn-ghost" onClick={() => onDone()}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

// ======================= 실행 이력 =======================

function LogsTab() {
  const [logs, setLogs] = useState<AdActionLogItem[] | null>(null);

  useEffect(() => {
    listAdActionLogs(100)
      .then(setLogs)
      .catch(() => setLogs([]));
  }, []);

  if (logs == null) return <Loading />;
  if (logs.length === 0) {
    return (
      <div className="card card-pad">
        <p className="ads-muted">아직 실행 이력이 없습니다.</p>
      </div>
    );
  }
  return (
    <div className="card card-table">
      <table>
        <thead>
          <tr>
            <th>시각</th>
            <th>계기</th>
            <th>매체 · 캠페인</th>
            <th>동작</th>
            <th>결과</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{fmt(l.createdAt)}</td>
              <td>{l.trigger === "RULE" ? `규칙 · ${l.ruleName ?? ""}` : "수동"}</td>
              <td>
                {l.platformLabel} · {l.campaignName ?? l.campaignId ?? "-"}
              </td>
              <td>{l.action === "PAUSE_CAMPAIGN" ? "끄기" : l.action === "RESUME_CAMPAIGN" ? "켜기" : l.action}</td>
              <td>
                {l.success ? (
                  <span className="badge b-normal">성공</span>
                ) : (
                  <span className="badge b-bad" title={l.message ?? ""}>
                    실패
                  </span>
                )}
                {!l.success && l.message && <div className="ads-help">{l.message}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
