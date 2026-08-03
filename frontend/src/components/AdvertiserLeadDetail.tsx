import { useEffect, useState } from "react";
import { Loading } from "./Loading";
import {
  ADVERTISER_LEAD_STATUSES,
  addAdvertiserNote,
  ApiError,
  getAdvertiserLead,
  listAdvertiserNotes,
  updateAdvertiserLeadStatus,
  type AdvertiserLead,
  type AdvertiserNote,
} from "../api/client";

interface Props {
  leadId: number;
  canStatus: boolean;
  canMemo: boolean;
  onClose: () => void;
  onChanged: (lead: AdvertiserLead) => void;
}

/**
 * 광고주 리드 상세 (모바일 퍼스트).
 * 핵심 동선은 <b>전화 걸기</b> — 상단에 큰 버튼으로 둔다.
 * 화면을 열면 서버가 최초 열람 시각을 기록하므로, 마케터가 '확인 여부'를 알 수 있다.
 */
export function AdvertiserLeadDetail({ leadId, canStatus, canMemo, onClose, onChanged }: Props) {
  const [lead, setLead] = useState<AdvertiserLead | null>(null);
  const [notes, setNotes] = useState<AdvertiserNote[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 상세 조회가 열람 기록을 남긴다(최초 1회).
        const [l, n] = await Promise.all([getAdvertiserLead(leadId), listAdvertiserNotes(leadId)]);
        if (!alive) return;
        setLead(l);
        setNotes(n);
        onChanged(l);
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : "불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // onChanged 는 매 렌더 새 함수라 의존성에서 제외(leadId 기준으로만 재조회)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const phone = lead?.answers
    .find((a) => /연락처|전화|휴대|폰|phone|tel/i.test(a.label ?? ""))
    ?.value?.replace(/[^0-9+]/g, "");

  async function onStatus(next: string) {
    if (!lead || next === lead.advertiserStatus) return;
    setBusy(true);
    setError("");
    try {
      const updated = await updateAdvertiserLeadStatus(lead.id, next);
      setLead(updated);
      onChanged(updated);
      setNotes(await listAdvertiserNotes(lead.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "상태 변경에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function onAddNote() {
    if (!lead || !noteInput.trim()) return;
    setBusy(true);
    setError("");
    try {
      await addAdvertiserNote(lead.id, noteInput.trim());
      setNoteInput("");
      setNotes(await listAdvertiserNotes(lead.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "메모 저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lead-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card lead-modal client-modal" role="dialog" aria-modal="true">
        <div className="lead-modal-head">
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              접수 내역
            </p>
            <h2 style={{ margin: "4px 0 0" }}>리드 상세</h2>
            {lead && (
              <p className="dash-sub" style={{ margin: "4px 0 0" }}>
                {new Date(lead.createdAt).toLocaleString("ko-KR")}
              </p>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="lead-modal-body">
          {loading ? (
            <Loading />
          ) : !lead ? (
            <p className="auth-error">{error || "리드를 찾을 수 없습니다."}</p>
          ) : (
            <>
              {phone && (
                <a className="btn btn-primary call-btn" href={`tel:${phone}`}>
                  📞 {phone} 전화하기
                </a>
              )}

              {error && <p className="auth-error">{error}</p>}

              <div className="card-h">답변</div>
              <div className="lead-answers">
                {lead.answers.map((a, i) => (
                  <div className="lead-answer" key={i}>
                    <span className="lead-a-label">{a.label}</span>
                    <span className="lead-a-value">{a.value || "-"}</span>
                  </div>
                ))}
              </div>

              <div className="card-h" style={{ marginTop: 20 }}>진행 상태</div>
              {canStatus ? (
                <div className="status-picker">
                  {ADVERTISER_LEAD_STATUSES.map((s) => (
                    <button
                      key={s.value}
                      disabled={busy}
                      className={lead.advertiserStatus === s.value ? `chip on st-${s.value}` : `chip st-${s.value}`}
                      onClick={() => onStatus(s.value)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="dash-sub">
                  현재 상태: <strong>{lead.advertiserStatusLabel}</strong> (변경 권한이 없습니다)
                </p>
              )}

              <div className="card-h" style={{ marginTop: 20 }}>메모 · 이력</div>
              {notes.length === 0 ? (
                <p className="dash-sub">아직 메모가 없습니다.</p>
              ) : (
                <ul className="note-list">
                  {notes.map((n) => (
                    <li key={n.id} className={n.kind === "SYSTEM" ? "note sys" : "note"}>
                      <span className="note-body">{n.body}</span>
                      <span className="note-at">{new Date(n.createdAt).toLocaleString("ko-KR")}</span>
                    </li>
                  ))}
                </ul>
              )}

              {canMemo && (
                <div className="note-add">
                  <textarea
                    className="input"
                    rows={2}
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="통화 결과, 특이사항 등 (담당 마케터도 볼 수 있습니다)"
                  />
                  <button className="btn btn-primary" disabled={busy || !noteInput.trim()} onClick={onAddNote}>
                    메모 추가
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
