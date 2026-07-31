import { useEffect, useState } from "react";
import {
  ApiError,
  cancelInvite,
  deleteAdvertiser,
  getAdvertiserLogs,
  getAdvertiserResponseReport,
  inviteUrl,
  issueInvite,
  issuePasswordReset,
  passwordResetUrl,
  listAdvertisers,
  listInvites,
  reissueInvite,
  setAdvertiserActive,
  updateAdvertiser,
  type AdvertiserInvite,
  type AdvertiserLog,
  type AdvertiserReport,
  type AdvertiserSummary,
  type PasswordResetIssued,
} from "../api/client";
import { TopBar } from "../components/TopBar";
import { useNavigate } from "react-router-dom";
import { Pagination, usePaging } from "../components/Pagination";
import { GrantEditor } from "../components/GrantEditor";
import { BrandSettingsCard } from "../components/BrandSettingsCard";

const fmt = (v: string | null) => (v ? new Date(v).toLocaleString("ko-KR") : "-");

/** 초 → 사람이 읽는 시간(분/시간). null 이면 '—'. */
function fmtDuration(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}초`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}시간 ${mm}분` : `${h}시간`;
}

export function AdvertisersPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdvertiserSummary[]>([]);
  const [invites, setInvites] = useState<AdvertiserInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 초대 발급 모달
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", company: "" });
  const [issued, setIssued] = useState<AdvertiserInvite | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [copied, setCopied] = useState(false);

  const [grantTarget, setGrantTarget] = useState<AdvertiserSummary | null>(null);
  // 비밀번호 재설정 링크(발급 직후 1회만 표시)
  const [resetIssued, setResetIssued] = useState<PasswordResetIssued | null>(null);
  const [resetCopied, setResetCopied] = useState(false);
  const [editTarget, setEditTarget] = useState<AdvertiserSummary | null>(null);
  const [editForm, setEditForm] = useState({ name: "", company: "", memo: "" });
  // 활동 이력 모달
  const [logsTarget, setLogsTarget] = useState<AdvertiserSummary | null>(null);
  const [logs, setLogs] = useState<AdvertiserLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  async function openLogs(a: AdvertiserSummary) {
    setLogsTarget(a);
    setLogs([]);
    setLogsLoading(true);
    try {
      setLogs(await getAdvertiserLogs(a.id));
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }

  // 처리속도 리포트 모달
  const [reportTarget, setReportTarget] = useState<AdvertiserSummary | null>(null);
  const [report, setReport] = useState<AdvertiserReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  async function openReport(a: AdvertiserSummary) {
    setReportTarget(a);
    setReport(null);
    setReportLoading(true);
    try {
      setReport(await getAdvertiserResponseReport(a.id));
    } catch {
      setReport(null);
    } finally {
      setReportLoading(false);
    }
  }

  const paging = usePaging(items, 10);
  const pendingInvites = invites.filter((i) => !i.acceptedAt);

  async function load() {
    setLoading(true);
    try {
      const [advertisers, inviteList] = await Promise.all([listAdvertisers(), listInvites()]);
      setItems(advertisers);
      setInvites(inviteList);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onIssue() {
    setError("");
    setIssuing(true);
    try {
      const res = await issueInvite({
        email: inviteForm.email.trim(),
        name: inviteForm.name.trim() || undefined,
        company: inviteForm.company.trim() || undefined,
      });
      setIssued(res);
      setCopied(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "초대 발급에 실패했습니다.");
    } finally {
      setIssuing(false);
    }
  }

  async function onReissue(inviteId: number) {
    setError("");
    try {
      const res = await reissueInvite(inviteId);
      setIssued(res);
      setCopied(false);
      setInviteOpen(true);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "재발급에 실패했습니다.");
    }
  }

  async function onCancelInvite(inviteId: number, email: string) {
    if (!window.confirm(`${email} 초대를 취소할까요? 발급된 링크는 즉시 무효가 됩니다.`)) return;
    await cancelInvite(inviteId);
    load();
  }

  async function onToggleActive(a: AdvertiserSummary) {
    const next = !a.active;
    const msg = next
      ? `${a.email} 계정을 다시 활성화할까요?`
      : `${a.email} 계정을 정지할까요? 로그인 중이어도 곧 접속이 차단됩니다.`;
    if (!window.confirm(msg)) return;
    await setAdvertiserActive(a.id, next);
    load();
  }

  async function onDelete(a: AdvertiserSummary) {
    const ok = window.confirm(
      `${a.email} 광고주 계정을 삭제할까요?\n\n` +
        `· 부여한 리드폼 권한도 함께 사라집니다.\n` +
        `· 리드 데이터는 그대로 남습니다(광고주 계정만 삭제).\n` +
        `· 열람·다운로드 기록은 감사 목적으로 보존됩니다.`,
    );
    if (!ok) return;
    await deleteAdvertiser(a.id);
    load();
  }

  async function onIssueReset(a: AdvertiserSummary) {
    const ok = window.confirm(
      `${a.email} 의 비밀번호 재설정 링크를 발급할까요?

` +
        `· 링크를 전달하면 광고주가 새 비밀번호를 직접 정합니다.
` +
        `· 이전에 발급한 재설정 링크는 즉시 무효가 됩니다.
` +
        `· 현재 비밀번호는 광고주가 새로 정할 때까지 그대로 쓸 수 있습니다.`,
    );
    if (!ok) return;
    setError("");
    try {
      setResetIssued(await issuePasswordReset(a.id));
      setResetCopied(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "재설정 링크 발급에 실패했습니다.");
    }
  }

  async function copyResetLink(token: string) {
    try {
      await navigator.clipboard.writeText(passwordResetUrl(token));
      setResetCopied(true);
    } catch {
      setResetCopied(false);
    }
  }

  function openEdit(a: AdvertiserSummary) {
    setEditTarget(a);
    setEditForm({ name: a.name ?? "", company: a.company ?? "", memo: a.memo ?? "" });
  }

  async function onSaveEdit() {
    if (!editTarget) return;
    await updateAdvertiser(editTarget.id, {
      name: editForm.name.trim() || undefined,
      company: editForm.company,
      memo: editForm.memo,
    });
    setEditTarget(null);
    load();
  }

  function closeInviteModal() {
    setInviteOpen(false);
    setIssued(null);
    setInviteForm({ email: "", name: "", company: "" });
    setError("");
  }

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">광고주 관리</p>
            <h1 className="dash-title">광고주</h1>
            <p className="dash-sub">
              광고주 계정을 만들어 <strong>지정한 리드폼의 리드만</strong> 보게 할 수 있습니다. 광고주는 확인·상태변경·엑셀
              내려받기만 가능하고 <strong>삭제는 할 수 없습니다.</strong>
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setInviteOpen(true)}>
            + 광고주 초대
          </button>
        </div>

        {error && !inviteOpen && <p className="auth-error">{error}</p>}

        <BrandSettingsCard />

        {pendingInvites.length > 0 && (
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div className="card-h">초대 대기 중 ({pendingInvites.length})</div>
            <p className="dash-sub" style={{ marginTop: 4 }}>
              광고주가 링크로 접속해 비밀번호를 정하면 계정이 만들어집니다.
            </p>
            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>이메일</th>
                  <th>회사</th>
                  <th>만료</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((i) => (
                  <tr key={i.id}>
                    <td>{i.email}</td>
                    <td>{i.company ?? "-"}</td>
                    <td className="num">{fmt(i.expiresAt)}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => onReissue(i.id)}>
                        링크 재발급
                      </button>
                      <button className="btn btn-ghost btn-sm danger" onClick={() => onCancelInvite(i.id, i.email)}>
                        취소
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {loading ? (
          <p className="dash-sub">불러오는 중…</p>
        ) : items.length === 0 ? (
          <div className="card card-pad empty-state">
            <p>아직 등록된 광고주가 없습니다.</p>
            <button className="btn btn-primary" onClick={() => setInviteOpen(true)}>
              첫 광고주 초대하기
            </button>
          </div>
        ) : (
          <>
            <div className="card">
              <table>
                <thead>
                  <tr>
                    <th>광고주</th>
                    <th>회사</th>
                    <th>리드폼</th>
                    <th>마지막 접속</th>
                    <th>상태</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paging.pageItems.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{a.name}</div>
                        <div className="dash-sub" style={{ fontSize: 13 }}>
                          {a.email}
                        </div>
                        {a.memo && (
                          <div className="dash-sub" style={{ fontSize: 12, marginTop: 2 }}>
                            📝 {a.memo}
                          </div>
                        )}
                      </td>
                      <td>{a.company ?? "-"}</td>
                      <td className="num">
                        {a.grantCount > 0 ? (
                          <span className="pill i">{a.grantCount}개</span>
                        ) : (
                          <span className="dash-sub">없음</span>
                        )}
                      </td>
                      <td className="num">{fmt(a.lastLoginAt)}</td>
                      <td>{a.active ? <span className="pill g">활성</span> : <span className="pill w">정지</span>}</td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => setGrantTarget(a)}>
                          리드폼 권한
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}>
                          정보
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openLogs(a)}
                          title="열람·상태변경·메모·내보내기 등 활동 이력"
                        >
                          활동 이력
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openReport(a)}
                          title="접수→열람/상태 평균, 미확인율 등 처리속도"
                        >
                          리포트
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => navigate(`/advertisers/${a.id}/preview`)}
                          title="광고주가 보는 화면을 읽기 전용으로 미리보기"
                        >
                          미리보기
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => onIssueReset(a)}
                          title="광고주가 비밀번호를 잊었을 때 재설정 링크를 발급합니다"
                        >
                          비번 재설정
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => onToggleActive(a)}>
                          {a.active ? "정지" : "활성화"}
                        </button>
                        <button className="btn btn-ghost btn-sm danger" onClick={() => onDelete(a)}>
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              total={paging.total}
              page={paging.page}
              pages={paging.pages}
              pageSize={paging.pageSize}
              onPage={paging.setPage}
              onPageSize={paging.setPageSize}
              unit="명"
            />
          </>
        )}
      </main>

      {/* 초대 발급 모달 */}
      {inviteOpen && (
        <div className="lead-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && closeInviteModal()}>
          <div className="card lead-modal invite-modal" role="dialog" aria-modal="true">
            <div className="lead-modal-head">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>
                  광고주 관리
                </p>
                <h2 style={{ margin: "4px 0 0" }}>{issued ? "초대 링크 생성 완료" : "광고주 초대"}</h2>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={closeInviteModal}>
                닫기
              </button>
            </div>

            <div className="lead-modal-body">
              {!issued ? (
                <>
                  <p className="dash-sub" style={{ marginTop: 0 }}>
                    초대 링크를 만들어 카톡·메일로 전달하세요. 광고주가 직접 비밀번호를 정합니다(마케터는 광고주 비밀번호를
                    알 수 없습니다).
                  </p>
                  {error && <p className="auth-error">{error}</p>}
                  <div className="field">
                    <label>이메일 *</label>
                    <input
                      className="input"
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      placeholder="advertiser@example.com"
                    />
                  </div>
                  <div className="field">
                    <label>담당자 이름</label>
                    <input
                      className="input"
                      value={inviteForm.name}
                      onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                      placeholder="홍길동"
                    />
                  </div>
                  <div className="field">
                    <label>회사명</label>
                    <input
                      className="input"
                      value={inviteForm.company}
                      onChange={(e) => setInviteForm({ ...inviteForm, company: e.target.value })}
                      placeholder="○○병원"
                    />
                  </div>
                  <div className="grant-foot">
                    <span />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-ghost" onClick={closeInviteModal}>
                        취소
                      </button>
                      <button className="btn btn-primary" disabled={issuing || !inviteForm.email.trim()} onClick={onIssue}>
                        {issuing ? "발급 중…" : "초대 링크 만들기"}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="dash-sub" style={{ marginTop: 0 }}>
                    <strong>{issued.email}</strong> 님에게 아래 링크를 전달하세요.
                  </p>
                  <div className="notice-box warn">
                    ⚠️ 이 링크는 <strong>지금만 볼 수 있습니다.</strong> 창을 닫으면 다시 확인할 수 없고, 필요하면 목록에서
                    재발급해야 합니다.
                  </div>
                  <div className="copy-box">
                    <input
                      className="input"
                      readOnly
                      value={issued.token ? inviteUrl(issued.token) : ""}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <button className="btn btn-primary" onClick={() => issued.token && copyLink(issued.token)}>
                      {copied ? "복사됨 ✓" : "복사"}
                    </button>
                  </div>
                  <p className="dash-sub" style={{ fontSize: 13 }}>
                    유효기간: {fmt(issued.expiresAt)}까지
                  </p>
                  <div className="grant-foot">
                    <span />
                    <button className="btn btn-primary" onClick={closeInviteModal}>
                      확인
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 정보 수정 모달 */}
      {editTarget && (
        <div className="lead-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setEditTarget(null)}>
          <div className="card lead-modal invite-modal" role="dialog" aria-modal="true">
            <div className="lead-modal-head">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>
                  {editTarget.email}
                </p>
                <h2 style={{ margin: "4px 0 0" }}>광고주 정보</h2>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditTarget(null)}>
                닫기
              </button>
            </div>
            <div className="lead-modal-body">
              <div className="field">
                <label>담당자 이름</label>
                <input
                  className="input"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label>회사명</label>
                <input
                  className="input"
                  value={editForm.company}
                  onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                />
              </div>
              <div className="field">
                <label>내부 메모 (광고주에게 보이지 않습니다)</label>
                <textarea
                  className="input"
                  rows={3}
                  value={editForm.memo}
                  onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
                  placeholder="단가, 계약기간, 담당자 특이사항 등"
                />
              </div>
              <div className="grant-foot">
                <span />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-ghost" onClick={() => setEditTarget(null)}>
                    취소
                  </button>
                  <button className="btn btn-primary" onClick={onSaveEdit}>
                    저장
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 재설정 링크 (발급 직후 1회만) */}
      {resetIssued && (
        <div className="lead-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setResetIssued(null)}>
          <div className="card lead-modal invite-modal" role="dialog" aria-modal="true">
            <div className="lead-modal-head">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>
                  {resetIssued.email}
                </p>
                <h2 style={{ margin: "4px 0 0" }}>비밀번호 재설정 링크</h2>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setResetIssued(null)}>
                닫기
              </button>
            </div>
            <div className="lead-modal-body">
              <p className="dash-sub" style={{ marginTop: 0 }}>
                이 링크를 광고주에게 전달하세요. 광고주가 <strong>직접 새 비밀번호를 정합니다</strong>(마케터는 알 수
                없습니다).
              </p>
              <div className="notice-box warn">
                ⚠️ 이 링크는 <strong>지금만 볼 수 있습니다.</strong> 창을 닫으면 다시 확인할 수 없고, 필요하면 다시
                발급해야 합니다.
              </div>
              <div className="copy-box">
                <input
                  className="input"
                  readOnly
                  value={passwordResetUrl(resetIssued.token)}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button className="btn btn-primary" onClick={() => copyResetLink(resetIssued.token)}>
                  {resetCopied ? "복사됨 ✓" : "복사"}
                </button>
              </div>
              <p className="dash-sub" style={{ fontSize: 13 }}>
                유효기간: {fmt(resetIssued.expiresAt)}까지 (1회용)
              </p>
              <div className="grant-foot">
                <span />
                <button className="btn btn-primary" onClick={() => setResetIssued(null)}>
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {grantTarget && (
        <GrantEditor
          advertiser={grantTarget}
          onClose={() => setGrantTarget(null)}
          onSaved={() => {
            setGrantTarget(null);
            load();
          }}
        />
      )}

      {/* 처리속도 리포트 모달 */}
      {reportTarget && (
        <div className="lead-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setReportTarget(null)}>
          <div className="card lead-modal invite-modal" role="dialog" aria-modal="true">
            <div className="lead-modal-head">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>
                  {reportTarget.company || reportTarget.email}
                </p>
                <h2 style={{ margin: "4px 0 0" }}>처리속도 리포트</h2>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setReportTarget(null)}>
                닫기
              </button>
            </div>
            <div className="lead-modal-body">
              {reportLoading ? (
                <p className="dash-sub">불러오는 중…</p>
              ) : !report ? (
                <p className="dash-sub">리포트를 불러오지 못했습니다.</p>
              ) : report.total === 0 ? (
                <p className="dash-sub">배정된 리드폼에 아직 리드가 없습니다.</p>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
                    <div className="card card-pad">
                      <span className="ck-label">총 접수</span>
                      <div className="ck-val" style={{ fontSize: 22 }}>{report.total.toLocaleString()}</div>
                    </div>
                    <div className="card card-pad">
                      <span className="ck-label">미확인율</span>
                      <div className="ck-val" style={{ fontSize: 22 }}>{Math.round(report.unseenRate * 100)}%</div>
                    </div>
                    <div className="card card-pad">
                      <span className="ck-label">평균 확인까지</span>
                      <div className="ck-val" style={{ fontSize: 18 }}>{fmtDuration(report.avgSecondsToSeen)}</div>
                    </div>
                    <div className="card card-pad">
                      <span className="ck-label">평균 처리까지</span>
                      <div className="ck-val" style={{ fontSize: 18 }}>{fmtDuration(report.avgSecondsToStatus)}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {report.statusCounts.map((s) => (
                      <span key={s.status} className={`pill st-${s.status}`}>
                        {s.label} {s.count}
                      </span>
                    ))}
                  </div>
                  <p className="dash-sub" style={{ fontSize: 12, marginTop: 12 }}>
                    이 광고주에게 배정된 <b>모든 리드폼</b>을 합산한 값입니다. '평균 처리까지'는 광고주의 상태 변경 시각 기준입니다.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 활동 이력 모달 */}
      {logsTarget && (
        <div className="lead-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setLogsTarget(null)}>
          <div className="card lead-modal invite-modal" role="dialog" aria-modal="true">
            <div className="lead-modal-head">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>
                  {logsTarget.email}
                </p>
                <h2 style={{ margin: "4px 0 0" }}>활동 이력</h2>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setLogsTarget(null)}>
                닫기
              </button>
            </div>
            <div className="lead-modal-body">
              {logsLoading ? (
                <p className="dash-sub">불러오는 중…</p>
              ) : logs.length === 0 ? (
                <p className="dash-sub">아직 활동 이력이 없습니다.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>일시</th>
                      <th>활동</th>
                      <th>상세</th>
                      <th>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id}>
                        <td className="num">{fmt(l.createdAt)}</td>
                        <td>{l.actionLabel}</td>
                        <td className="dash-sub">
                          {l.detail || (l.leadId ? `리드 #${l.leadId}` : "")}
                        </td>
                        <td className="dash-sub">{l.ip || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="dash-sub" style={{ fontSize: 12, marginTop: 10 }}>
                열람·상태변경·메모·내보내기·로그인 기록입니다. 개인정보 취급 추적과 분쟁 대비를 위해 보관됩니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
