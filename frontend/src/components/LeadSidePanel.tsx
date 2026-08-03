import { useCallback, useEffect, useState } from "react";
import { Loading } from "./Loading";
import {
  addLeadNote,
  deleteLeadNote,
  getLead,
  listLeadNotes,
  updateLeadStatus,
  updateLeadTags,
  LEAD_STATUSES,
  type Lead,
  type LeadNote,
} from "../api/client";

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
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [l, n] = await Promise.all([getLead(leadId), listLeadNotes(leadId)]);
      setLead(l);
      setNotes(n);
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

  async function changeStatus(status: string) {
    if (!lead || status === lead.status || busy) return;
    setBusy(true);
    try {
      await updateLeadStatus(leadId, status);
      const fresh = await reload(); // 상태변경 SYSTEM 이력이 서버에 쌓이므로 다시 읽는다
      if (fresh) onChanged?.(fresh);
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
      const note = await addLeadNote(leadId, body);
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

          {/* 상태 */}
          <div className="ip-section-label">상태</div>
          <div className="ip-status-picker">
            {LEAD_STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                className={`chip ld-chip ld-${s.value}${lead.status === s.value ? " on" : ""}`}
                disabled={busy}
                onClick={() => changeStatus(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>

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
                    {n.kind === "SYSTEM" ? "이력" : "메모"} ·{" "}
                    {new Date(n.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
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
            placeholder="메모 추가…"
          />
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
