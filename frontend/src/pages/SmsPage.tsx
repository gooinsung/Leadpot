import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  getSmsStatus,
  listSmsLogs,
  testSms,
  type MessageLogItem,
  type SmsStatus,
} from "../api/client";
import { Loading } from "../components/Loading";
import { TopBar } from "../components/TopBar";
import { toast } from "../lib/toast";

const RECIPIENT_LABEL: Record<string, string> = {
  MARKETER: "나(마케터)",
  ADVERTISER: "광고주",
  LEAD: "고객",
  TEST: "테스트",
};

const STATUS_LABEL: Record<string, string> = {
  SENT: "발송",
  FAILED: "실패",
  SKIPPED: "보내지 않음",
};

function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function SmsPage() {
  const [status, setStatus] = useState<SmsStatus | null>(null);
  const [logs, setLogs] = useState<MessageLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [testTo, setTestTo] = useState("");
  const [sending, setSending] = useState(false);

  function reload() {
    return Promise.all([getSmsStatus(), listSmsLogs()])
      .then(([s, l]) => {
        setStatus(s);
        setLogs(l);
      })
      .catch(() => toast.error("문자 발송 정보를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  async function onTest() {
    setSending(true);
    try {
      const r = await testSms({ to: testTo.trim() || undefined });
      if (r.ok) {
        toast.success(`테스트 문자를 보냈습니다. (${r.channel} · ${r.bytes}byte)`);
      } else {
        // 실패 사유를 그대로 보여준다 — 미등록 발신번호·잔액 부족 등 조치가 필요한 내용이 담긴다.
        toast.error(r.error || "발송에 실패했습니다.");
      }
      await reload();
    } catch {
      toast.error("발송 요청에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  // ⚠️ 한도 규약이 V25 에서 바뀌었다 — **0 = 금지, -1 = 무제한**.
  // 예전 코드는 `limit > 0` 이 아니면 무제한으로 표시해서, 금지(0)를 "무제한"으로 보여줬다.
  // 남은 건수는 서버가 계산해 준 값(status.remaining)을 쓴다.
  const unlimited = !!status && status.limit < 0;

  return (
    // ⚠️ 반드시 .app-shell 로 감싼다 — 이게 없으면 LNB 가로 배치 규칙(.app-shell:has(.app-nav))이
    // 안 걸려 본문이 LNB(100vh) 아래로 밀린다(2026-08-09 사용자 제보: 이력이 푸터 밑에 렌더).
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">운영</p>
            <h1 className="dash-title">문자 발송</h1>
            <p className="dash-sub">
              리드가 접수될 때 나갈 문자를 리드폼별로 켭니다. 설정은 <Link to="/forms">리드폼</Link> 편집 화면의{" "}
              <b>문자 발송</b> 칸에 있습니다.
            </p>
          </div>
        </div>

        {loading ? (
          <Loading full />
        ) : (
          <>
            {status && (
              <div className="card card-pad">
                <div className="card-h">발송 현황</div>
                {/* 권한이 없는 것과 설정이 없는 것은 원인·조치가 다르다 — 구분해서 안내한다.
                    (권한은 마케터가 고칠 수 없고 운영자에게 문의해야 한다) */}
                {!status.smsEnabled ? (
                  <p className="auth-error" style={{ marginBottom: 12 }}>
                    이 계정은 문자 발송 권한이 없습니다. 필요하시면 운영자에게 문의해주세요.
                  </p>
                ) : (
                  !status.ready && (
                    <p className="auth-error" style={{ marginBottom: 12 }}>
                      아직 문자를 보낼 수 없습니다. 발신번호가 등록되지 않았습니다.
                    </p>
                  )
                )}
                <div className="kpis kpis-3" style={{ marginBottom: 12 }}>
                  <div className="kpi">
                    <div className="k-label">이번 달 발송</div>
                    <div className="k-val">{status.used.toLocaleString()}</div>
                  </div>
                  <div className="kpi">
                    <div className="k-label">남은 한도</div>
                    <div className="k-val">
                      {unlimited ? "무제한" : status.remaining.toLocaleString()}
                    </div>
                  </div>
                  <div className="kpi">
                    <div className="k-label">이번 달 실패</div>
                    <div className="k-val">{status.failed.toLocaleString()}</div>
                  </div>
                </div>
                <p className="dash-sub">
                  발신번호 <b>{status.senderPhone || "미설정"}</b> · 요금제 {status.plan}
                  {unlimited
                    ? " (월 한도 없음)"
                    : status.limit > 0
                      ? ` (월 ${status.limit.toLocaleString()}건)`
                      : " (월 한도 0건 — 발송 불가)"}
                </p>
                {status.smsEnabled && (
                  <p className="dash-sub" style={{ marginTop: 6 }}>
                    허용 채널 <b>{status.allowedChannels.length ? status.allowedChannels.join(" · ") : "없음"}</b>
                    {!status.allowedChannels.includes("LMS") && (
                      <>
                        {" "}— ⚠️ 본문이 <b>90byte</b>를 넘으면 LMS 로 나가는데 이 계정은 LMS 권한이 없어
                        발송이 막힙니다.
                      </>
                    )}
                  </p>
                )}
                {status.failed > 0 && (
                  <p className="dash-sub" style={{ marginTop: 6 }}>
                    ⚠️ 실패한 발송이 있습니다. 자동 재시도는 하지 않으니 아래 이력에서 사유를 확인해주세요.
                  </p>
                )}

                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
                  <label className="field" style={{ maxWidth: 240 }}>
                    <span className="field-label">테스트 발송 번호</span>
                    <input
                      className="input"
                      value={testTo}
                      onChange={(e) => setTestTo(e.target.value)}
                      placeholder="비우면 내 계정 연락처"
                    />
                  </label>
                  <button className="btn btn-primary" type="button" onClick={onTest} disabled={sending}>
                    {sending ? "보내는 중…" : "테스트 발송"}
                  </button>
                </div>
                <p className="dash-sub" style={{ fontSize: 12, marginTop: 6 }}>
                  테스트도 실제로 발송되어 건당 비용이 발생하고 사용량에 포함됩니다.
                </p>
              </div>
            )}

            <div style={{ marginTop: 20 }}>
              <div className="dash-sub" style={{ marginBottom: 8 }}>
                발송 이력 (최근 100건)
              </div>
              {logs.length === 0 ? (
                <div className="card card-pad">
                  <div className="empty-state">
                    <p>아직 발송 이력이 없습니다.</p>
                    <Link className="btn btn-primary" to="/forms">
                      리드폼에서 문자 켜기
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="card card-table">
                  <table>
                    <thead>
                      <tr>
                        <th>시각</th>
                        <th>수신자</th>
                        <th>번호</th>
                        <th>구분</th>
                        <th>상태</th>
                        <th>내용 · 사유</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((m) => (
                        <tr key={m.id}>
                          <td>{when(m.createdAt)}</td>
                          <td>{RECIPIENT_LABEL[m.recipientType] ?? m.recipientType}</td>
                          <td>{m.recipient}</td>
                          <td>{m.channel}</td>
                          <td>{STATUS_LABEL[m.status] ?? m.status}</td>
                          <td>
                            {m.error ? (
                              <span className="auth-error" style={{ margin: 0 }}>
                                {m.error}
                              </span>
                            ) : (
                              <span className="dash-sub">{m.body}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
