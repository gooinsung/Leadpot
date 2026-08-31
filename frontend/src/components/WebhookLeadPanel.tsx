import { useEffect, useState } from "react";
import {
  disableWebhook,
  enableWebhook,
  getWebhookConfig,
  regenerateWebhookToken,
  saveWebhookMapping,
  webhookLeadUrl,
  type WebhookLeadConfig,
} from "../api/client";
import { toast } from "../lib/toast";

const NONE = ""; // select 값: 매핑 안 함

/** select 값 ↔ {answerMapping/consentMapping} 변환. "answer:라벨" / "consent:제목" / "" 로 다룬다. */
function selectValue(key: string, cfg: { answerMapping: Record<string, string>; consentMapping: Record<string, string> }) {
  if (cfg.answerMapping[key] !== undefined) return `answer:${cfg.answerMapping[key]}`;
  if (cfg.consentMapping[key] !== undefined) return `consent:${cfg.consentMapping[key]}`;
  return NONE;
}

/**
 * 리드폼 편집기의 "웹훅으로 리드 수신" 섹션(V39, 범용 인바운드).
 * Zapier·Make·LeadsBridge 등 무엇이든 이 URL 로 POST 하면 리드로 들어온다 — 마케터가
 * 직접 켜고, URL을 복사해 외부 도구에 등록하고, 최근 수신 페이로드로 매핑을 맞춘다.
 */
export function WebhookLeadPanel({ formId, isNew }: { formId: number | null; isNew: boolean }) {
  const [config, setConfig] = useState<WebhookLeadConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [freshToken, setFreshToken] = useState(""); // 방금 발급/재발급된 토큰(이번 화면에서만 보임)
  const [answerMapping, setAnswerMapping] = useState<Record<string, string>>({});
  const [consentMapping, setConsentMapping] = useState<Record<string, string>>({});
  const [externalIdKey, setExternalIdKey] = useState<string>("");
  const [mappingDirty, setMappingDirty] = useState(false);

  async function load() {
    if (!formId || isNew) return;
    setLoading(true);
    try {
      const c = await getWebhookConfig(formId);
      setConfig(c);
      setAnswerMapping(c.answerMapping ?? {});
      setConsentMapping(c.consentMapping ?? {});
      setExternalIdKey(c.externalIdKey ?? "");
      setMappingDirty(false);
    } catch {
      toast.error("웹훅 설정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, isNew]);

  if (isNew || !formId) {
    return (
      <div className="card card-pad" style={{ marginTop: 16 }}>
        <div className="card-h"><span>웹훅으로 리드 수신</span></div>
        <p className="dash-sub">먼저 저장한 뒤 이용할 수 있어요.</p>
      </div>
    );
  }

  async function onEnable() {
    setBusy(true);
    try {
      const { token } = await enableWebhook(formId!);
      setFreshToken(token);
      await load();
      toast.success("웹훅 수신을 켰습니다. URL을 복사해 외부 도구에 등록하세요.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function onRegenerate() {
    if (!confirm("토큰을 재발급하면 기존 URL은 즉시 무효화됩니다. 외부 도구(Zapier 등)에도 새 URL로 다시 등록해야 합니다. 계속할까요?")) return;
    setBusy(true);
    try {
      const { token } = await regenerateWebhookToken(formId!);
      setFreshToken(token);
      toast.success("토큰을 재발급했습니다. 새 URL로 외부 도구를 다시 설정하세요.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function onDisable() {
    if (!confirm("웹훅 수신을 끄면 외부 도구가 보낸 리드가 더 이상 저장되지 않습니다. 계속할까요?")) return;
    setBusy(true);
    try {
      await disableWebhook(formId!);
      setFreshToken("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function onMapChange(key: string, value: string) {
    const nextA = { ...answerMapping };
    const nextC = { ...consentMapping };
    delete nextA[key];
    delete nextC[key];
    if (value.startsWith("answer:")) nextA[key] = value.slice(7);
    else if (value.startsWith("consent:")) nextC[key] = value.slice(8);
    setAnswerMapping(nextA);
    setConsentMapping(nextC);
    setMappingDirty(true);
  }

  function onExternalIdChange(key: string) {
    setExternalIdKey((prev) => (prev === key ? "" : key));
    setMappingDirty(true);
  }

  async function onSaveMapping() {
    setBusy(true);
    try {
      const c = await saveWebhookMapping(formId!, {
        answerMapping,
        consentMapping,
        externalIdKey: externalIdKey || null,
      });
      setConfig(c);
      setMappingDirty(false);
      toast.success("매핑을 저장했습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setBusy(false);
    }
  }

  const enabled = config?.enabled ?? false;
  const payloadKeys = config?.lastPayload ? Object.keys(config.lastPayload) : [];

  return (
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <div className="card-h"><span>웹훅으로 리드 수신</span></div>
      <label className="fr-check">
        <input type="checkbox" checked={enabled} disabled={busy || loading} onChange={(e) => (e.target.checked ? onEnable() : onDisable())} />
        {" "}이 리드폼을 외부 웹훅으로 받기(Zapier·Make·LeadsBridge 등)
      </label>
      <p className="dash-sub" style={{ marginTop: 6 }}>
        켜면 이 리드폼의 공개 URL(/f/…)은 막히고, 대신 아래 웹훅 URL 로 들어오는 리드만 받습니다.
        메타 잠재고객 폼 등 외부 서비스가 이 URL 로 리드를 보내도록 설정하세요.
      </p>

      {enabled && (
        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {freshToken ? (
            <div className="field">
              <span className="field-label">웹훅 URL</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input className="input" readOnly value={webhookLeadUrl(freshToken)} style={{ flex: 1, minWidth: 260 }} />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookLeadUrl(freshToken));
                    toast.success("복사했습니다.");
                  }}
                >
                  복사
                </button>
              </div>
              <span className="field-optional" style={{ color: "var(--danger, #c0392b)", marginTop: 4 }}>
                ⚠️ 이 URL은 지금만 보여집니다. 지금 복사해 외부 도구에 등록하세요 — 나중에 다시 볼 수 없습니다(재발급만 가능).
              </span>
            </div>
          ) : (
            <div className="field">
              <span className="field-label">웹훅 URL</span>
              <p className="dash-sub">보안을 위해 URL은 활성화/재발급 시에만 한 번 표시됩니다.</p>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onRegenerate}>
                토큰 재발급(URL 다시 보기)
              </button>
            </div>
          )}

          {(config?.lastError || config?.lastReceivedAt) && (
            <div>
              {config.lastReceivedAt && (
                <span className="dash-sub" style={{ fontSize: 12 }}>
                  최근 수신: {new Date(config.lastReceivedAt).toLocaleString("ko-KR")}
                </span>
              )}
              {config.lastError && (
                <div className="badge b-bad" style={{ marginTop: 4, maxWidth: 520, whiteSpace: "normal" }}>
                  최근 처리 실패: {config.lastError}
                </div>
              )}
            </div>
          )}

          {payloadKeys.length > 0 ? (
            <div>
              <span className="field-label">매핑 — 최근 수신한 값을 우리 리드폼 항목에 연결하세요</span>
              <div style={{ overflowX: "auto", marginTop: 6 }}>
                <table className="table" style={{ minWidth: 520 }}>
                  <thead>
                    <tr>
                      <th>받은 키</th>
                      <th>받은 값(예시)</th>
                      <th>연결할 항목</th>
                      <th>멱등성 ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payloadKeys.map((key) => (
                      <tr key={key}>
                        <td><code>{key}</code></td>
                        <td className="dash-sub" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {String(config?.lastPayload?.[key] ?? "")}
                        </td>
                        <td>
                          <select
                            className="input"
                            value={selectValue(key, { answerMapping, consentMapping })}
                            onChange={(e) => onMapChange(key, e.target.value)}
                          >
                            <option value={NONE}>매핑 안 함</option>
                            {(config?.availableAnswerLabels ?? []).length > 0 && (
                              <optgroup label="답변 항목">
                                {config!.availableAnswerLabels.map((l) => (
                                  <option key={`a-${l}`} value={`answer:${l}`}>{l}</option>
                                ))}
                              </optgroup>
                            )}
                            {(config?.availableConsentTitles ?? []).length > 0 && (
                              <optgroup label="동의 항목">
                                {config!.availableConsentTitles.map((t) => (
                                  <option key={`c-${t}`} value={`consent:${t}`}>{t}</option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <input type="radio" name="webhook-extid" checked={externalIdKey === key} onChange={() => onExternalIdChange(key)} title="이 값을 중복 방지 기준으로 사용" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="dash-sub" style={{ fontSize: 12, marginTop: 6 }}>
                "멱등성 ID"는 같은 리드가 두 번 들어오는 것을 막을 기준값입니다(예: 메타의 leadgen_id). 비워두면 값 전체를 기준으로 자동 판단합니다.
              </p>
              <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 8 }} disabled={busy || !mappingDirty} onClick={onSaveMapping}>
                매핑 저장
              </button>
            </div>
          ) : (
            <p className="dash-sub">
              아직 받은 페이로드가 없습니다. 외부 도구에서 위 URL로 테스트 전송을 한 번 보내면, 받은 키를 여기서 매핑할 수 있어요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
