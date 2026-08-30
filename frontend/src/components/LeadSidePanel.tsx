import { useCallback, useEffect, useState } from "react";
import { Loading } from "./Loading";
import {
  addLeadNote,
  deleteLeadNote,
  getLead,
  getLeadAdvertiserActivity,
  getLeadStatusOptions,
  listAsRequests,
  listLeadNotes,
  resolveAsRequest,
  updateLeadStatus,
  updateLeadTags,
  ApiError,
  type AsRequest,
  type Lead,
  type LeadAdvertiserActivity,
  type LeadNote,
  type LeadStatusOption,
} from "../api/client";
import { leadStatusClass, pickName, pickPhone } from "../lib/leadDisplay";
import { trackingKeyLabel } from "../lib/tracking";

/** 확신 등급 배지 문구(V33). 등급 정의는 api/client.ts 의 AdvertiserActivityLevel 참고. */
const ADV_LEVEL_LABEL: Record<string, string> = {
  NOT_VIEWED: "열람 기록 없음",
  VIEWED: "열람함",
  ACTED: "열람 + 처리함",
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

/** 두 시각 사이 간격을 사람이 읽는 말로("29분" · "3시간" · "2일"). */
function elapsed(from: string, to: string | null): string {
  if (!to) return "-";
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "-";
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}분`;
  const hour = Math.round(min / 60);
  if (hour < 48) return `${hour}시간`;
  return `${Math.round(hour / 24)}일`;
}

interface Props {
  /** 표시할 리드 id. 바뀌면 패널 내용이 교체된다. */
  leadId: number;
  /** 헤더에 보여줄 리드폼 이름(없으면 생략). */
  formName?: string;
  /**
   * pane   = 통합 인박스 스플릿 뷰의 오른쪽 상세(상시 표시, 2단 그리드 — 가이드 §4)
   * drawer = 일반 페이지 우측에 겹치는 서랍(목록 맥락 유지, 딤 배경 없음)
   */
  variant?: "pane" | "drawer";
  onClose: () => void;
  /** 상태·태그·메모 변경 후 최신 리드를 부모에게 알린다(목록 갱신용). */
  onChanged?: (lead: Lead) => void;
  /** 폼별 뷰로 가는 링크 표시(통합 인박스에서만 의미 있음). */
  showFormLink?: boolean;
}

/**
 * 리드 상세 패널 (U2 → 리디자인 §4) — 통합 인박스(스플릿 pane)와 폼별 목록(서랍)이 함께 쓴다.
 * pane 은 히어로 헤더(폼명·#id / 이름 / 연락처·접수일시 / [폼에서 열기][유효로 확정]) +
 * 2단 그리드(답변·방문자 | 상태·태그·메모)로 배치가 다르고, 내용(섹션)은 두 변형이 공유한다.
 */
export function LeadSidePanel({
  leadId,
  formName,
  variant = "pane",
  onClose,
  onChanged,
  showFormLink,
}: Props) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [memo, setMemo] = useState("");
  // 광고주메모(공유) / 마케터메모(전용) 선택 — 기본은 내부용(실수로 새어나가지 않게).
  const [memoShared, setMemoShared] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // 통합 상태 축(V29): 고정 4 + 이 폼 광고주의 커스텀. 폼별로 다르므로 리드마다 다시 불러온다.
  const [options, setOptions] = useState<LeadStatusOption[]>([]);
  const [asHistory, setAsHistory] = useState<AsRequest[]>([]);
  const [asNote, setAsNote] = useState("");
  // 광고주가 이 리드를 보기는 했는지(V33). 실패해도 상세 자체는 떠야 하므로 null 로 두고 섹션만 접는다.
  const [advActivity, setAdvActivity] = useState<LeadAdvertiserActivity | null>(null);
  const [advOpen, setAdvOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [l, n, as, adv] = await Promise.all([
        getLead(leadId),
        listLeadNotes(leadId),
        listAsRequests(leadId).catch(() => [] as AsRequest[]),
        getLeadAdvertiserActivity(leadId).catch(() => null),
      ]);
      setLead(l);
      setNotes(n);
      setAsHistory(as);
      setAdvActivity(adv);
      getLeadStatusOptions(l.formId).then(setOptions).catch(() => setOptions([]));
      return l;
    } catch {
      setLead(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    setMemo("");
    setTagInput("");
    setAdvOpen(false);
    reload();
  }, [reload]);

  // ESC 로 닫기 (pane 은 상시 표시라 서랍에서만 의미가 있지만 무해)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function changeStatus(opt: LeadStatusOption) {
    if (!lead || opt.key === lead.statusKey || busy) return;
    setBusy(true);
    setError("");
    try {
      await updateLeadStatus(leadId, opt.status, opt.customStatusId);
      const fresh = await reload(); // 상태변경 SYSTEM 이력이 서버에 쌓이므로 다시 읽는다
      if (fresh) onChanged?.(fresh);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "상태를 변경하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  /** AS 인정(→무효·환급) / 거부(→유효 확정). */
  async function resolveAs(accept: boolean) {
    if (!lead || busy) return;
    setBusy(true);
    setError("");
    try {
      await resolveAsRequest(leadId, accept, asNote.trim());
      setAsNote("");
      const fresh = await reload();
      if (fresh) onChanged?.(fresh);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "AS 처리에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function saveTags(next: string[]) {
    if (!lead) return;
    setBusy(true);
    const before = lead;
    setLead({ ...lead, tags: next }); // 낙관적 반영
    try {
      const updated = await updateLeadTags(leadId, next);
      setLead(updated);
      onChanged?.(updated);
    } catch {
      setLead(before);
    } finally {
      setBusy(false);
    }
  }

  function addTag() {
    const v = tagInput.trim();
    setTagInput("");
    if (!v || (lead?.tags ?? []).includes(v)) return;
    void saveTags([...(lead?.tags ?? []), v]);
  }

  async function submitMemo() {
    const body = memo.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const note = await addLeadNote(leadId, body, memoShared);
      setNotes((prev) => [...prev, note]);
      setMemo("");
    } finally {
      setBusy(false);
    }
  }

  async function removeNote(noteId: number) {
    setNotes((prev) => prev.filter((n) => n.id !== noteId)); // 낙관적 제거
    try {
      await deleteLeadNote(leadId, noteId);
    } catch {
      listLeadNotes(leadId).then(setNotes).catch(() => {});
    }
  }

  const tags = lead?.tags ?? [];
  const split = variant === "pane";
  const validOpt = options.find((o) => o.status === "VALID");
  const canConfirmValid =
    !!lead && !!validOpt && lead.statusKey !== "VALID" && lead.statusKey !== "AS_REQUESTED";

  /* ---------- 섹션 (두 변형이 공유) ---------- */

  const answersSection = lead && (
    <div className="card card-pad ip-answers">
      <div className="ip-section-label" style={{ marginTop: 0 }}>답변</div>
      {lead.answers.map((a, i) => (
        <div key={`${a.label}-${i}`} className="ip-answer">
          <span className="ip-k">{a.label}</span>
          <span className="ip-v">{a.value || "-"}</span>
        </div>
      ))}
    </div>
  );

  const visitorSection = lead && (
    <div className="card card-pad ip-answers">
      <div className="ip-section-label" style={{ marginTop: 0 }}>방문자</div>
      <div className="ip-answer">
        <span className="ip-k">기기</span>
        <span className="ip-v">{[lead.device, lead.os, lead.browser].filter(Boolean).join(" · ") || "-"}</span>
      </div>
      <div className="ip-answer">
        <span className="ip-k">IP · 언어</span>
        <span className="ip-v">{`${lead.submitterIp ?? "-"} · ${lead.language ?? "-"}`}</span>
      </div>
      {lead.referer && (
        <div className="ip-answer"><span className="ip-k">유입</span><span className="ip-v">{lead.referer}</span></div>
      )}
      {lead.utm && Object.keys(lead.utm).length > 0 && (
        <div className="ip-answer">
          <span className="ip-k">출처</span>
          <span className="ip-v">{Object.entries(lead.utm).map(([k, v]) => `${trackingKeyLabel(k)} ${v}`).join(" · ")}</span>
        </div>
      )}
    </div>
  );

  const statusTagsSection = lead && (
    <div className={split ? "card card-pad" : ""}>
      {/* 상태 — 통합 축(V29). 유효로 넘기면 과금(단가 차감)이 확정된다. */}
      <div className="ip-section-label" style={split ? { marginTop: 0 } : undefined}>상태</div>
      {lead.statusKey === "AS_REQUESTED" ? (
        <p className="dash-sub" style={{ margin: "0 0 6px" }}>
          AS 처리 대기 중입니다. 아래 <b>AS 요청</b>에서 인정/거부로 처리하세요.
        </p>
      ) : (
        <div className="ip-status-picker">
          {options.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`chip ld-chip ld-${leadStatusClass(s.key)}${lead.statusKey === s.key ? " on" : ""}`}
              disabled={busy || s.status === "AS_REQUESTED"}
              onClick={() => changeStatus(s)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      {split && (
        <p className="dash-sub" style={{ fontSize: 12, margin: "10px 0 0" }}>
          유효로 확정하면 광고주 잔액에서 단가가 차감됩니다.
        </p>
      )}

      {/* 태그 */}
      <div className="ip-section-label">태그</div>
      <div className="ip-tags">
        {tags.map((t) => (
          <span key={t} className="badge ip-tag">
            {t}
            <button className="tag-x" onClick={() => saveTags(tags.filter((x) => x !== t))} disabled={busy} aria-label={`${t} 태그 제거`}>
              ×
            </button>
          </span>
        ))}
        <input
          className="input ip-tag-input"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder="태그 입력 후 Enter"
          maxLength={40}
        />
      </div>
    </div>
  );

  /**
   * 광고주 확인(V33) — "보낸 리드를 광고주가 보기는 했나".
   * 확인/미확인 한 비트가 아니라 <b>언제·몇 번 봤고 처리까지 했는지</b>를 보여준다.
   * 배정된 광고주가 없으면(또는 조회 실패) 아예 그리지 않는다.
   */
  const advertiserSection = lead && advActivity && advActivity.level !== "NO_ADVERTISER" && (
    <div className={split ? "card card-pad" : ""}>
      <div className="ip-section-label" style={split ? { marginTop: 0 } : undefined}>광고주 확인</div>
      <div className={`adv-seen lv-${advActivity.level.toLowerCase()}`}>
        <span className="adv-seen-badge">{ADV_LEVEL_LABEL[advActivity.level]}</span>
        <span className="adv-seen-who">
          {advActivity.advertiserName}
          {!advActivity.advertiserActive && " · 비활성 계정"}
        </span>
      </div>
      <p className="dash-sub adv-seen-line">
        {advActivity.level === "NOT_VIEWED" ? (
          <>
            포털에서 연 기록이 없습니다.{" "}
            {advActivity.advertiserLastLoginAt
              ? `마지막 로그인 ${fmtDateTime(advActivity.advertiserLastLoginAt)}.`
              : "포털에 로그인한 적이 없습니다."}
            <br />
            알림톡·구글시트로만 처리했을 수도 있어 <b>안 봤다는 확정은 아닙니다.</b>
          </>
        ) : (
          <>
            {fmtDateTime(advActivity.firstViewedAt)} 최초 열람
            {` (접수 ${elapsed(lead.createdAt, advActivity.firstViewedAt)} 뒤)`}
            {advActivity.viewCount > 1 && ` · 열람 ${advActivity.viewCount}회`}
            {advActivity.lastViewedAt !== advActivity.firstViewedAt &&
              ` · 최근 ${fmtDateTime(advActivity.lastViewedAt)}`}
            {advActivity.acted && <><br />상태 변경·메모까지 남겼습니다.</>}
          </>
        )}
      </p>
      {advActivity.entries.length > 0 && (
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdvOpen((v) => !v)}>
            {advOpen ? "이력 접기" : `이력 ${advActivity.entries.length}건 보기`}
          </button>
          {advOpen && (
            <ul className="ip-notes adv-seen-log">
              {advActivity.entries.map((e) => (
                <li key={e.id} className="ip-note sys">
                  <span className="ip-note-meta">
                    {e.actionLabel}
                    {" · "}
                    {fmtDateTime(e.createdAt)}
                    {e.ip && ` · ${e.ip}`}
                  </span>
                  {e.detail && <div>{e.detail}</div>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );

  const asSection = asHistory.length > 0 && (
    <div className={split ? "card card-pad" : ""}>
      <div className="ip-section-label" style={split ? { marginTop: 0 } : undefined}>AS 요청</div>
      <div className={split ? "ip-answers" : "card card-pad ip-answers"}>
        {asHistory.map((r) => (
          <div key={r.id} style={{ display: "grid", gap: 4, paddingBottom: 8 }}>
            <span className="ip-note-meta">
              {r.status === "OPEN" ? "⏳ 처리 대기" : r.status === "ACCEPTED" ? "✅ 인정(무효 처리)" : "❌ 거부(유효 확정)"}
              {" · "}
              {new Date(r.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
            </span>
            <div>사유: {r.reason}</div>
            {r.evidenceUrls.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {r.evidenceUrls.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer">
                    <img src={u} alt="증빙" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }} />
                  </a>
                ))}
              </div>
            )}
            {r.resolutionNote && <div className="dash-sub">처리 코멘트: {r.resolutionNote}</div>}
            {r.status === "OPEN" && (
              <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
                <input
                  className="input"
                  value={asNote}
                  onChange={(e) => setAsNote(e.target.value)}
                  placeholder="처리 코멘트 (선택)"
                  maxLength={500}
                />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => resolveAs(true)}>
                    AS 인정 → 무효(환급)
                  </button>
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => resolveAs(false)}>
                    거부 → 유효 확정
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const notesSection = lead && (
    <div className={split ? "card card-pad" : ""}>
      <div className="ip-section-label" style={split ? { marginTop: 0 } : undefined}>메모 · 이력</div>
      {notes.length > 0 && (
        <ul className="ip-notes">
          {notes.map((n) => (
            <li key={n.id} className={`ip-note${n.kind === "SYSTEM" ? " sys" : ""}`}>
              <span className="ip-note-meta">
                {n.kind === "SYSTEM" ? "이력" : n.sharedWithAdvertiser ? "광고주메모" : "마케터메모"}
                {/* 작성자 역할 표기(2026-08-08 확정): 마케터/광고주 */}
                {n.authorRole === "ADVERTISER" && " · 광고주"}
                {n.authorRole === "MARKETER" && n.kind === "MEMO" && " · 마케터"}
                {" · "}
                {new Date(n.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                {n.authorDeleted && " · 삭제된 광고주"}
                {n.kind === "MEMO" && (
                  <button className="tag-x ip-note-x" onClick={() => removeNote(n.id)} aria-label="메모 삭제">×</button>
                )}
              </span>
              <div>{n.body}</div>
            </li>
          ))}
        </ul>
      )}
      <textarea
        className="input"
        rows={2}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder={memoShared ? "광고주메모 추가… (광고주에게도 보입니다)" : "마케터메모 추가… (나만 봅니다)"}
      />
      <div className="ip-actions">
        <label className="dash-sub" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <input type="checkbox" checked={memoShared} onChange={(e) => setMemoShared(e.target.checked)} />
          광고주와 공유
        </label>
        <button className="btn btn-primary btn-sm" onClick={submitMemo} disabled={busy || !memo.trim()}>메모 저장</button>
      </div>
    </div>
  );

  const errorLine = error && (
    <p style={{ margin: "4px 0 0", color: "var(--danger, #e5484d)", fontSize: 13 }}>{error}</p>
  );

  /* ---------- pane(스플릿) 배치 ---------- */
  if (split) {
    return (
      <aside className="inbox-panel ip-split" aria-label="리드 상세">
        {loading && !lead ? (
          <Loading />
        ) : !lead ? (
          <p className="inbox-empty">불러오지 못했습니다.</p>
        ) : (
          <>
            <div className="ip-hero">
              <div className="ip-hero-main">
                <div className="ip-hero-cap">{formName ? `${formName} · ` : ""}#{leadId}</div>
                <h2 className="ip-hero-name">{pickName(lead.answers)}</h2>
                <div className="ip-hero-sub tnum">
                  {pickPhone(lead.answers) ?? "연락처 없음"} · {new Date(lead.createdAt).toLocaleString("ko-KR")} 접수
                </div>
              </div>
              <div className="ip-hero-actions">
                {showFormLink && (
                  <a className="btn btn-ghost btn-sm" href={`/forms/${lead.formId}/leads`}>폼에서 열기</a>
                )}
                {canConfirmValid && (
                  <button
                    className="btn btn-green btn-sm"
                    disabled={busy}
                    onClick={() => validOpt && changeStatus(validOpt)}
                  >
                    유효로 확정
                  </button>
                )}
              </div>
            </div>
            {errorLine}
            <div className="ip-grid">
              <div className="ip-col">
                {answersSection}
                {visitorSection}
              </div>
              <div className="ip-col">
                {statusTagsSection}
                {advertiserSection}
                {asSection}
                {notesSection}
              </div>
            </div>
          </>
        )}
      </aside>
    );
  }

  /* ---------- drawer(서랍) 배치 — 기존 1열 흐름 ---------- */
  return (
    <aside className="inbox-panel lead-drawer" aria-label="리드 상세">
      <div className="ip-head">
        <div className="ip-head-title">
          <span className="ip-title">리드 상세 · #{leadId}</span>
          <span className="ip-head-meta">
            {formName ? `${formName} · ` : ""}
            {lead ? new Date(lead.createdAt).toLocaleString("ko-KR") : ""}
          </span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>닫기 ✕</button>
      </div>

      {loading && !lead ? (
        <Loading />
      ) : !lead ? (
        <p className="inbox-empty">불러오지 못했습니다.</p>
      ) : (
        <div className="ip-body">
          {answersSection}
          {statusTagsSection}
          {advertiserSection}
          {asSection}
          {errorLine}
          {visitorSection}
          {notesSection}
          {showFormLink && (
            <div className="ip-actions">
              <a className="btn btn-ghost btn-sm" href={`/forms/${lead.formId}/leads`}>폼에서 열기 →</a>
              <span />
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
