import { useCallback, useEffect, useState } from "react";
import { Loading } from "./Loading";
import {
  addLeadNote,
  deleteLeadNote,
  getLead,
  getLeadStatusOptions,
  listAsRequests,
  listLeadNotes,
  resolveAsRequest,
  updateLeadStatus,
  updateLeadTags,
  ApiError,
  type AsRequest,
  type Lead,
  type LeadNote,
  type LeadStatusOption,
} from "../api/client";
import { leadStatusClass } from "../lib/leadDisplay";

interface Props {
  /** 표시할 리드 id. 바뀌면 패널 내용이 교체된다. */
  leadId: number;
  /** 헤더에 보여줄 리드폼 이름(없으면 생략). */
  formName?: string;
  /**
   * pane   = 통합 인박스의 3-pane 중 오른쪽 칸(레이아웃 흐름 안)
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
 * 리드 상세 사이드 패널 (U2) — 통합 인박스와 폼별 리드 목록이 함께 쓴다.
 * 모달이 아니라 패널이라 목록 맥락이 유지된다. 읽기 + 상태변경 + 태그 + 메모/이력.
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

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [l, n, as] = await Promise.all([
        getLead(leadId),
        listLeadNotes(leadId),
        listAsRequests(leadId).catch(() => [] as AsRequest[]),
      ]);
      setLead(l);
      setNotes(n);
      setAsHistory(as);
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
    reload();
  }, [reload]);

  // ESC 로 닫기
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

  return (
    <aside className={variant === "drawer" ? "inbox-panel lead-drawer" : "inbox-panel"} aria-label="리드 상세">
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
          {/* 답변 */}
          <div className="ip-section-label">답변</div>
          <div className="card card-pad ip-answers">
            {lead.answers.map((a, i) => (
              <div key={`${a.label}-${i}`} className="ip-answer">
                <span className="ip-k">{a.label}</span>
                <span className="ip-v">{a.value || "-"}</span>
              </div>
            ))}
          </div>

          {/* 상태 — 통합 축(V29). 유효로 넘기면 과금(단가 차감)이 확정된다. */}
          <div className="ip-section-label">상태</div>
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
                  title={s.status === "VALID" ? "유효로 확정하면 광고주 잔액에서 단가가 차감됩니다(정산 설정 시)" : undefined}
                  onClick={() => changeStatus(s)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* AS 요청(V30) — 광고주 이의. 대기 중이면 인정/거부 버튼을 노출한다. */}
          {asHistory.length > 0 && (
            <>
              <div className="ip-section-label">AS 요청</div>
              <div className="card card-pad ip-answers">
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
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => resolveAs(true)}>
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
            </>
          )}

          {error && <p style={{ margin: "4px 0 0", color: "var(--danger, #e5484d)", fontSize: 13 }}>{error}</p>}

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

          {/* 방문자 정보 */}
          <div className="ip-section-label">방문자</div>
          <div className="card card-pad ip-answers">
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
                <span className="ip-k">UTM</span>
                <span className="ip-v">{Object.entries(lead.utm).map(([k, v]) => `${k}=${v}`).join(" · ")}</span>
              </div>
            )}
          </div>

          {/* 메모 / 이력 */}
          <div className="ip-section-label">메모 · 이력</div>
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
          <label className="dash-sub" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 4 }}>
            <input type="checkbox" checked={memoShared} onChange={(e) => setMemoShared(e.target.checked)} />
            광고주와 공유(광고주메모)
          </label>
          <div className="ip-actions">
            {showFormLink ? (
              <a className="btn btn-ghost btn-sm" href={`/forms/${lead.formId}/leads`}>폼에서 열기 →</a>
            ) : (
              <span />
            )}
            <button className="btn btn-primary btn-sm" onClick={submitMemo} disabled={busy || !memo.trim()}>메모 저장</button>
          </div>
        </div>
      )}
    </aside>
  );
}
