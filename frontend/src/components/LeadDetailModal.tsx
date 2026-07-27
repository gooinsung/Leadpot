import { useEffect, useRef, useState } from "react";
import {
  addLeadNote,
  deleteLeadNote,
  LEAD_STATUSES,
  listLeadNotes,
  updateLeadStatus,
  updateLeadTags,
  type Lead,
  type LeadNote,
} from "../api/client";

interface Props {
  lead: Lead;
  formName: string;
  onClose: () => void;
  onChange: (lead: Lead) => void; // 상태/태그 변경을 부모 목록에 반영
}

function statusClass(status: string) {
  if (status === "DONE") return "b-normal";
  if (status === "SPAM") return "b-bad";
  if (status === "IN_PROGRESS") return "b-wait";
  return "";
}

/** 리드 상세: 전체 답변·방문자정보 + 태그 편집 + 메모/이력. */
export function LeadDetailModal({ lead, formName, onClose, onChange }: Props) {
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [noteInput, setNoteInput] = useState("");
  const [tags, setTags] = useState<string[]>(lead.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTags(lead.tags ?? []);
  }, [lead]);

  useEffect(() => {
    setNotesLoading(true);
    listLeadNotes(lead.id)
      .then(setNotes)
      .catch(() => {})
      .finally(() => setNotesLoading(false));
  }, [lead.id]);

  // ESC 로 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onStatus(status: string) {
    const updated = { ...lead, status };
    onChange(updated);
    try {
      await updateLeadStatus(lead.id, status);
      // 상태변경 자동 이력이 서버에 쌓이므로 메모 목록 새로고침
      listLeadNotes(lead.id).then(setNotes).catch(() => {});
    } catch {
      /* 실패 시 부모가 다음 로드에서 정정 */
    }
  }

  async function saveTags(next: string[]) {
    setBusy(true);
    try {
      const updated = await updateLeadTags(lead.id, next);
      setTags(updated.tags ?? []);
      onChange(updated);
    } catch {
      setTags(lead.tags ?? []);
    } finally {
      setBusy(false);
    }
  }

  function addTag() {
    const v = tagInput.trim();
    if (!v || tags.includes(v)) {
      setTagInput("");
      return;
    }
    const next = [...tags, v];
    setTags(next);
    setTagInput("");
    void saveTags(next);
  }

  function removeTag(t: string) {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    void saveTags(next);
  }

  async function onAddNote() {
    const body = noteInput.trim();
    if (!body) return;
    setBusy(true);
    try {
      const note = await addLeadNote(lead.id, body);
      setNotes((prev) => [...prev, note]);
      setNoteInput("");
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteNote(noteId: number) {
    setNotes((prev) => prev.filter((n) => n.id !== noteId)); // 낙관적
    try {
      await deleteLeadNote(lead.id, noteId);
    } catch {
      listLeadNotes(lead.id).then(setNotes).catch(() => {});
    }
  }

  return (
    <div className="lead-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card lead-modal" ref={dialogRef} role="dialog" aria-modal="true">
        <div className="lead-modal-head">
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>{formName}</p>
            <h2 style={{ margin: "4px 0 0" }}>리드 상세 · #{lead.id}</h2>
            <p className="dash-sub" style={{ margin: "4px 0 0" }}>
              {new Date(lead.createdAt).toLocaleString("ko-KR")}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              className={`lead-status-select ${statusClass(lead.status)}`}
              value={lead.status}
              onChange={(e) => onStatus(e.target.value)}
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>닫기</button>
          </div>
        </div>

        <div className="lead-modal-body">
          {/* 답변 */}
          <section>
            <div className="card-h">답변</div>
            <div className="lead-answers">
              {lead.answers.map((a, i) => (
                <div className="lead-answer" key={i}>
                  <span className="lead-a-label">{a.label}</span>
                  <span className="lead-a-value">{a.value || "-"}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 태그 */}
          <section style={{ marginTop: 18 }}>
            <div className="card-h">태그</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {tags.map((t) => (
                <span key={t} className="badge" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  {t}
                  <button
                    className="tag-x"
                    onClick={() => removeTag(t)}
                    aria-label={`${t} 태그 제거`}
                    disabled={busy}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                className="input"
                style={{ width: 160, height: 30, padding: "2px 8px" }}
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
          </section>

          {/* 방문자 정보 */}
          <section style={{ marginTop: 18 }}>
            <div className="card-h">방문자 정보</div>
            <div className="lead-meta" style={{ flexDirection: "column", gap: 4 }}>
              <span>🖥️ {lead.device ?? "-"} · {lead.os ?? "-"} · {lead.browser ?? "-"}</span>
              <span>🌐 IP {lead.submitterIp ?? "-"} · 언어 {lead.language ?? "-"}</span>
              {lead.referer && <span>↩️ {lead.referer}</span>}
              {lead.utm && Object.keys(lead.utm).length > 0 && (
                <span>📢 {Object.entries(lead.utm).map(([k, v]) => `${k}=${v}`).join(" · ")}</span>
              )}
            </div>
          </section>

          {/* 메모/이력 */}
          <section style={{ marginTop: 18 }}>
            <div className="card-h">메모 · 이력</div>
            {notesLoading ? (
              <p className="dash-sub">불러오는 중…</p>
            ) : notes.length === 0 ? (
              <p className="dash-sub" style={{ marginTop: 0 }}>아직 메모가 없습니다.</p>
            ) : (
              <ul className="lead-notes">
                {notes.map((n) => (
                  <li key={n.id} className={`lead-note ${n.kind === "SYSTEM" ? "sys" : ""}`}>
                    <div className="lead-note-body">
                      {n.kind === "SYSTEM" && <span className="badge b-wait" style={{ marginRight: 6 }}>이력</span>}
                      {n.body}
                    </div>
                    <div className="lead-note-foot">
                      <span className="dash-sub" style={{ fontSize: 12 }}>
                        {new Date(n.createdAt).toLocaleString("ko-KR")}
                      </span>
                      {n.kind === "MEMO" && (
                        <button className="tag-x" onClick={() => onDeleteNote(n.id)} aria-label="메모 삭제">×</button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <textarea
                className="input"
                rows={2}
                style={{ flex: 1, resize: "vertical" }}
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="상담 메모를 남겨보세요"
              />
              <button className="btn btn-primary" onClick={onAddNote} disabled={busy || !noteInput.trim()}>
                추가
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
