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
 * 구글 스프레드시트에 새로 쌓이는 행을 이 웹훅 URL로 자동 전송하는 Apps Script 초안.
 * 헤더 행(1행)의 각 열 이름을 그대로 JSON 키로 보낸다 — 아래 매핑 표에서 그 열 이름이 그대로 뜬다.
 * 행마다 "_rowId"를 자동으로 붙여 멱등성 ID로 쓸 수 있게 한다(재실행돼도 중복 저장 안 되게).
 */
function buildAppsScript(webhookUrl: string): string {
  return `// ===== 리드팟 웹훅 연동 스크립트 =====
// 설치법: 이 시트 → 확장 프로그램 → Apps Script → 아래 코드를 전부 붙여넣기
//        → 위 도구모음에서 함수를 setupTrigger 로 선택 → ▶ 실행 → 권한 승인
// 그러면 이 시트에 새 행이 생길 때마다(최대 1분 이내) 리드팟으로 자동 전송됩니다.

const WEBHOOK_URL = "${webhookUrl}"; // 리드팟이 발급한 웹훅 URL
const SHEET_NAME = ""; // 비워두면 첫 번째 시트. 특정 탭만 보내려면 탭 이름을 적으세요 (예: "설문지 응답 시트1")

// 최초 1회 또는 트리거를 다시 걸고 싶을 때 이 함수를 실행하세요.
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "checkNewLeads") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("checkNewLeads").timeBased().everyMinutes(1).create();
  checkNewLeads(); // 지금 있는 행도 한 번 확인해서 보낸다
}

// 1분마다 자동 실행 — 마지막으로 보낸 행 다음부터 새 행만 찾아 전송한다.
function checkNewLeads() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return; // 헤더뿐이면 보낼 게 없음

  const headers = data[0];
  const props = PropertiesService.getScriptProperties();
  const key = "lastRow_" + sheet.getSheetId();
  const lastRow = Number(props.getProperty(key) || 1); // 0행=헤더, 1부터가 첫 데이터 행
  const totalRows = data.length;
  if (totalRows <= lastRow) return; // 새 행 없음

  for (let r = lastRow; r < totalRows; r++) {
    const row = data[r];
    const payload = {};
    headers.forEach(function (h, i) {
      if (h) payload[String(h).trim()] = row[i];
    });
    // 같은 행이 두 번 전송돼도 리드팟이 중복 저장하지 않도록 고유값을 붙인다.
    // 리드팟 매핑 화면에서 "_rowId" 를 멱등성 ID로 지정하세요.
    payload["_rowId"] = sheet.getSheetId() + "-" + (r + 1);

    try {
      UrlFetchApp.fetch(WEBHOOK_URL, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });
    } catch (e) {
      // 이 행은 실패해도 다음 행은 계속 보낸다. lastRow 는 끝에서 한 번에 갱신.
    }
  }
  props.setProperty(key, String(totalRows));
}`;
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
  const [alwaysAgreedConsents, setAlwaysAgreedConsents] = useState<string[]>([]);
  const [mappingDirty, setMappingDirty] = useState(false);
  const [sheetsGuideOpen, setSheetsGuideOpen] = useState(false);

  async function load() {
    if (!formId || isNew) return;
    setLoading(true);
    try {
      const c = await getWebhookConfig(formId);
      setConfig(c);
      setAnswerMapping(c.answerMapping ?? {});
      setConsentMapping(c.consentMapping ?? {});
      setExternalIdKey(c.externalIdKey ?? "");
      setAlwaysAgreedConsents(c.alwaysAgreedConsents ?? []);
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

  function onToggleAlwaysAgreed(title: string, checked: boolean) {
    setAlwaysAgreedConsents((prev) => (checked ? [...prev, title] : prev.filter((t) => t !== title)));
    setMappingDirty(true);
  }

  async function onSaveMapping() {
    setBusy(true);
    try {
      const c = await saveWebhookMapping(formId!, {
        answerMapping,
        consentMapping,
        externalIdKey: externalIdKey || null,
        alwaysAgreedConsents,
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
        <div style={{ marginTop: 12, display: "grid", gap: 12, maxWidth: 620, minWidth: 0 }}>
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

          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, background: "var(--surface-2)" }}>
            <label className="fr-check">
              <input type="checkbox" checked={sheetsGuideOpen} onChange={(e) => setSheetsGuideOpen(e.target.checked)} />
              {" "}📊 구글 스프레드시트로 연결하기 (Apps Script)
            </label>
            <p className="dash-sub" style={{ marginTop: 6 }}>
              메타·당근 등 어떤 광고 매체든, 리드가 구글 스프레드시트에 쌓이기만 하면 이 방법으로 자동 연결할 수 있습니다.
              (코딩 지식 없이 아래 코드를 그대로 복사해 붙여넣기만 하면 됩니다)
            </p>

            {sheetsGuideOpen && (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6, fontSize: 14 }}>
                  <li>리드가 쌓이는 <b>구글 스프레드시트</b>를 엽니다. (1행은 반드시 항목 이름이어야 합니다 — 예: 이름, 연락처)</li>
                  <li>상단 메뉴에서 <b>확장 프로그램 → Apps Script</b>를 클릭합니다.</li>
                  <li>기존 코드를 지우고, 아래 코드를 <b>전체 복사해서 붙여넣습니다</b>.
                    {freshToken ? " (URL이 자동으로 채워져 있어요)" : " — 첫 줄의 URL 부분을 위에서 발급받은 웹훅 URL로 바꿔주세요."}
                  </li>
                  <li>화면 위쪽 함수 선택 드롭다운에서 <code>setupTrigger</code>를 고르고 <b>▶ 실행</b>을 누릅니다.</li>
                  <li>"권한 필요" 화면이 뜨면 내 계정 선택 → <b>고급</b> → "(안전하지 않음)으로 이동" → <b>허용</b>을 누릅니다.
                    (구글이 낯선 스크립트라 경고하는 것뿐, 본인이 만든 스크립트라 안전합니다)</li>
                  <li>완료! 이제 시트에 새 행이 생기면 <b>최대 1분 이내</b> 자동으로 리드팟에 들어옵니다. 아래 "매핑" 표에서 열 이름을 우리 항목에 연결해주세요.</li>
                </ol>

                <div className="field">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="field-label">Apps Script 코드</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        navigator.clipboard.writeText(buildAppsScript(freshToken ? webhookLeadUrl(freshToken) : "여기에-웹훅-URL을-붙여넣으세요"));
                        toast.success("코드를 복사했습니다.");
                      }}
                    >
                      코드 복사
                    </button>
                  </div>
                  <pre style={{
                    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
                    padding: 12, fontSize: 12, overflowX: "auto", maxHeight: 280, whiteSpace: "pre",
                    width: "100%", maxWidth: "100%", boxSizing: "border-box",
                  }}>
                    <code>{buildAppsScript(freshToken ? webhookLeadUrl(freshToken) : "여기에-웹훅-URL을-붙여넣으세요")}</code>
                  </pre>
                </div>
                <p className="dash-sub" style={{ fontSize: 12 }}>
                  ⚠️ 구글 정책상 시트 변경 즉시가 아니라 <b>최대 1분 주기</b>로 확인합니다(실시간은 아니지만 상담 응대엔 충분합니다).
                </p>
              </div>
            )}
          </div>

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

          {(config?.availableConsentTitles ?? []).length > 0 && (
            <div>
              <span className="field-label">동의 항목 처리</span>
              <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                {config!.availableConsentTitles.map((title) => (
                  <label key={title} className="fr-check" style={{ fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={alwaysAgreedConsents.includes(title)}
                      onChange={(e) => onToggleAlwaysAgreed(title, e.target.checked)}
                    />
                    {" "}<b>{title}</b> — 받은 값과 무관하게 항상 동의로 처리
                  </label>
                ))}
              </div>
              <p className="dash-sub" style={{ fontSize: 12, marginTop: 6 }}>
                메타 잠재고객 폼처럼 동의 체크 없이는 애초에 데이터가 안 넘어오는 경우 체크해두세요 —
                페이로드에 동의를 나타내는 값이 없어도 항상 동의로 저장됩니다(아래 매핑보다 우선 적용).
              </p>
              <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 8 }} disabled={busy || !mappingDirty} onClick={onSaveMapping}>
                저장
              </button>
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
