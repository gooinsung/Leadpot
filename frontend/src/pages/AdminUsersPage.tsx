import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ApiError,
  listAdminAudit,
  listAdminUsers,
  loginAsAdminUser,
  setTokens,
  updateAdminUserSms,
  type AdminAuditRow,
  type AdminUserRow,
  type SmsChannel,
} from "../api/client";
import { TopBar } from "../components/TopBar";
import { Loading } from "../components/Loading";
import { toast } from "../lib/toast";

/**
 * 운영자 계정 관리 — 문자 발송 권한 통제 + 계정 상세(읽기 전용 열람) 진입.
 *
 * 왜 필요한가: 문자는 리드팟 솔라피 계정 하나로 나가고 **비용을 우리가 부담**한다.
 * 예전에는 모든 마케터가 리드폼에서 자유롭게 켤 수 있었다.
 *
 * **정책 변경(2026-08-19, 사용자 결정)**: 원래 이 화면에 리드(고객 개인정보) 열람을 넣지
 * 않는 것이 원칙이었으나, 운영 지원을 위해 **읽기 전용 열람**을 허용했다. 계정을 클릭하면
 * 상세(`/admin/users/:id`)에서 리드폼·랜딩·리드를 조회할 수 있고, **리드 열람은 감사 이력에
 * 남는다**(서버 AdminService 주석 참고). 수정·삭제는 여전히 불가(서버에 API 자체가 없다).
 *
 * ⚠️ 화면 가드는 편의일 뿐이고 실제 차단은 서버가 한다(`/api/admin/**` → ROLE_ADMIN).
 *
 * 데스크톱 우선 화면이다(공개 화면이 아니므로 모바일 퍼스트 대상이 아니다). 다만 표는
 * `card-table`(overflow-x:auto)을 써서 좁은 화면에서 페이지가 넓어지지 않게 한다.
 */
const CHANNELS: SmsChannel[] = ["SMS", "LMS", "MMS", "ATA"];

/** 채널별 참고 단가(2026-08-04 솔라피 공개 페이지). ⚠️ 실제 청구 단가는 확인이 필요하다. */
const CHANNEL_HINT: Record<SmsChannel, string> = {
  SMS: "단문 · 약 18원",
  LMS: "장문(90byte 초과) · 약 45원",
  MMS: "첨부 포함 · 약 110원",
  // 기존 계정에는 이 채널이 꺼져 있다 — 켜 주기 전까지 마케터·광고주 알림이 나가지 않는다.
  ATA: "알림톡(마케터·광고주 알림) · 약 13원",
};

export function AdminUsersPage() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [audit, setAudit] = useState<AdminAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [loggingInId, setLoggingInId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    listAdminUsers(q)
      .then(setRows)
      .catch((e) => setError(e instanceof ApiError ? e.message : "불러오지 못했습니다."))
      .finally(() => setLoading(false));
    // 이력은 부가 정보 — 실패해도 화면 전체를 막지 않는다.
    listAdminAudit().then(setAudit).catch(() => setAudit([]));
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function patch(row: AdminUserRow, input: Parameters<typeof updateAdminUserSms>[1]) {
    setSavingId(row.id);
    try {
      const updated = await updateAdminUserSms(row.id, input);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      listAdminAudit().then(setAudit).catch(() => undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "변경하지 못했습니다.");
    } finally {
      setSavingId(null);
    }
  }

  async function onLoginAs(row: AdminUserRow) {
    if (!window.confirm(`${row.email} 계정으로 바로 로그인할까요?`)) return;
    setLoggingInId(row.id);
    try {
      const res = await loginAsAdminUser(row.id);
      setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      window.location.replace("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "로그인하지 못했습니다.");
      setLoggingInId(null);
    }
  }

  function toggleChannel(row: AdminUserRow, channel: SmsChannel) {
    const next = row.smsAllowedChannels.includes(channel)
      ? row.smsAllowedChannels.filter((c) => c !== channel)
      : [...row.smsAllowedChannels, channel];
    patch(row, { allowedChannels: next });
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">운영자</p>
            <h1 className="dash-title">계정 관리</h1>
            <p className="dash-sub">
              문자 발송은 <strong>비용을 리드팟이 부담</strong>하므로 계정별로 열어줍니다. 기본은 모두 꺼져 있습니다.
            </p>
          </div>
        </div>

        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <form
            className="edit-actions"
            style={{ alignItems: "flex-end" }}
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
          >
            <div className="field" style={{ marginBottom: 0, flex: "1 1 260px", minWidth: 0 }}>
              <label>계정 검색</label>
              <input
                className="input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="이메일 또는 이름"
                spellCheck={false}
              />
            </div>
            <button className="btn btn-primary" type="submit">검색</button>
          </form>
        </div>

        {loading ? (
          <Loading />
        ) : error && rows.length === 0 ? (
          <div className="card card-pad empty-state">
            <p>목록을 불러오지 못했습니다.</p>
            <button className="btn btn-ghost" onClick={load}>다시 시도</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="card card-pad empty-state">
            <p>조건에 맞는 계정이 없습니다.</p>
          </div>
        ) : (
          <div className="card card-table">
            <table>
              <thead>
                <tr>
                  <th>계정</th>
                  <th>권한</th>
                  <th>리드폼 / 리드</th>
                  <th>문자 발송</th>
                  <th>허용 채널</th>
                  <th>월 한도 / 사용</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const busy = savingId === r.id;
                  const isAdvertiser = r.role === "ADVERTISER";
                  return (
                    <tr key={r.id}>
                      <td>
                        {/* 계정 클릭 → 읽기 전용 상세(리드폼·랜딩·리드) */}
                        <Link to={`/admin/users/${r.id}`} style={{ fontWeight: 600 }}>
                          {r.email}
                        </Link>
                        <div className="lnb-link-desc">
                          {r.name}
                          {r.subdomain ? ` · ${r.subdomain}` : ""}
                          {!r.active ? " · 정지됨" : ""}
                        </div>
                        {r.role !== "ADMIN" && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ marginTop: 4 }}
                            disabled={loggingInId === r.id}
                            onClick={() => onLoginAs(r)}
                          >
                            {loggingInId === r.id ? "이동 중…" : "이 계정으로 로그인하기"}
                          </button>
                        )}
                      </td>
                      <td>
                        {r.role === "ADMIN" ? "운영자" : isAdvertiser ? "광고주" : "마케터"}
                        <div className="lnb-link-desc">{r.plan}</div>
                      </td>
                      <td>
                        {r.formCount} / {r.leadCount}
                      </td>
                      <td>
                        {isAdvertiser ? (
                          // 광고주는 발송 주체가 아니다(발송은 리드폼 소유 마케터 기준으로 나간다).
                          <span className="lnb-link-desc">해당 없음</span>
                        ) : (
                          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                            <input
                              type="checkbox"
                              checked={r.smsEnabled}
                              disabled={busy}
                              onChange={(e) => patch(r, { enabled: e.target.checked })}
                            />
                            <span>{r.smsEnabled ? "허용" : "차단"}</span>
                          </label>
                        )}
                      </td>
                      <td>
                        {isAdvertiser ? (
                          <span className="lnb-link-desc">—</span>
                        ) : (
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            {CHANNELS.map((c) => (
                              <label
                                key={c}
                                title={CHANNEL_HINT[c]}
                                style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
                              >
                                <input
                                  type="checkbox"
                                  checked={r.smsAllowedChannels.includes(c)}
                                  disabled={busy || !r.smsEnabled}
                                  onChange={() => toggleChannel(r, c)}
                                />
                                <span>{c}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        {isAdvertiser ? (
                          <span className="lnb-link-desc">—</span>
                        ) : (
                          <>
                            <LimitInput row={r} busy={busy} onSave={(v) => patch(r, { monthlyLimit: v })} />
                            <div className="lnb-link-desc">이번 달 {r.smsUsedThisMonth}건 사용</div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="dash-head" style={{ marginTop: 28 }}>
          <div>
            <h2 className="dash-title" style={{ fontSize: "1.1rem" }}>변경 이력</h2>
            <p className="dash-sub">
              권한 변경은 되돌릴 수 없는 흔적을 남깁니다. 이력은 삭제할 수 없습니다.
            </p>
          </div>
        </div>
        {audit.length === 0 ? (
          <div className="card card-pad empty-state">
            <p>아직 변경 이력이 없습니다.</p>
          </div>
        ) : (
          <div className="card card-table">
            <table>
              <thead>
                <tr>
                  <th>시각</th>
                  <th>수행</th>
                  <th>대상</th>
                  <th>내용</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td>{a.createdAt ? new Date(a.createdAt).toLocaleString("ko-KR") : "-"}</td>
                    <td>{a.adminEmail ?? a.adminId}</td>
                    <td>{a.targetEmail ?? a.targetId ?? "-"}</td>
                    <td>{a.detail ?? a.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * 월 한도 입력.
 *
 * ⚠️ **0 은 무제한이 아니라 금지**다(V25). 예전 플랜 상수는 0 을 무제한으로 해석했어서
 * 혼동하기 쉬우므로 화면에 그대로 적어 둔다. 무제한은 빈 값이 아니라 `-1` 로 저장한다.
 */
function LimitInput({
  row,
  busy,
  onSave,
}: {
  row: AdminUserRow;
  busy: boolean;
  onSave: (value: number) => void;
}) {
  const unlimited = row.monthlyLimit < 0;
  const [draft, setDraft] = useState(String(row.monthlyLimit));

  // 서버가 돌려준 값으로 동기화(다른 조작으로 행이 갱신될 수 있다).
  useEffect(() => setDraft(String(row.monthlyLimit)), [row.monthlyLimit]);

  function commit() {
    const n = Number(draft);
    if (!Number.isFinite(n) || Number.isNaN(n)) {
      setDraft(String(row.monthlyLimit));
      return;
    }
    const next = Math.trunc(n);
    if (next !== row.monthlyLimit) {
      onSave(next);
    }
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input
        className="input"
        style={{ width: 88 }}
        value={draft}
        disabled={busy}
        inputMode="numeric"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        title="0 = 금지 · -1 = 무제한"
      />
      <span className="lnb-link-desc">{unlimited ? "무제한" : row.monthlyLimit === 0 ? "금지" : "건"}</span>
    </div>
  );
}
