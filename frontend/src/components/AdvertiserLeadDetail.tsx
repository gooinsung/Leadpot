import { useEffect, useRef, useState } from "react";
import { Loading } from "./Loading";
import {
  addAdvertiserNote,
  ApiError,
  getAdvertiserLead,
  getAdvertiserStatusOptions,
  listAdvertiserAsRequests,
  listAdvertiserNotes,
  requestAdvertiserAs,
  updateAdvertiserLeadStatus,
  uploadAdvertiserEvidence,
  type AdvertiserLead,
  type AdvertiserNote,
  type AsRequest,
  type LeadStatusOption,
} from "../api/client";
import { leadStatusClass } from "../lib/leadDisplay";

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
 *
 * 진행상태는 마케터와 공유하는 단일 축(V29)이다. 여기서 <b>유효</b>로 넘기면 정산이 확정되고,
 * 이의가 있으면 <b>AS 요청</b>(사유 필수·증빙 이미지)으로 제기한다 — 무효 처리는 마케터만 한다.
 */
export function AdvertiserLeadDetail({ leadId, canStatus, canMemo, onClose, onChanged }: Props) {
  const [lead, setLead] = useState<AdvertiserLead | null>(null);
  const [notes, setNotes] = useState<AdvertiserNote[]>([]);
  const [options, setOptions] = useState<LeadStatusOption[]>([]);
  const [asHistory, setAsHistory] = useState<AsRequest[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // AS 요청 폼
  const [asOpen, setAsOpen] = useState(false);
  const [asReason, setAsReason] = useState("");
  const [asFiles, setAsFiles] = useState<string[]>([]); // 업로드된 증빙 URL
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 상세 조회가 열람 기록을 남긴다(최초 1회).
        const [l, n, as, opts] = await Promise.all([
          getAdvertiserLead(leadId),
          listAdvertiserNotes(leadId),
          listAdvertiserAsRequests(leadId).catch(() => [] as AsRequest[]),
          getAdvertiserStatusOptions().catch(() => [] as LeadStatusOption[]),
        ]);
        if (!alive) return;
        setLead(l);
        setNotes(n);
        setAsHistory(as);
        setOptions(opts);
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

  // 잠금 상태: AS 대기(마케터 처리 대기) 또는 무효(마케터 전용)
  const locked = lead?.statusKey === "AS_REQUESTED" || lead?.statusKey === "INVALID";

  async function onStatus(opt: LeadStatusOption) {
    if (!lead || opt.key === lead.statusKey || busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = await updateAdvertiserLeadStatus(lead.id, opt.status, opt.customStatusId);
      setLead(updated);
      onChanged(updated);
      setNotes(await listAdvertiserNotes(lead.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "상태 변경에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function onEvidenceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || asFiles.length >= 5) return;
    setUploading(true);
    setError("");
    try {
      const { url } = await uploadAdvertiserEvidence(file);
      setAsFiles((prev) => [...prev, url]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "증빙 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  }

  async function submitAs() {
    if (!lead || !asReason.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await requestAdvertiserAs(lead.id, asReason.trim(), asFiles);
      setAsOpen(false);
      setAsReason("");
      setAsFiles([]);
      const [l, as, n] = await Promise.all([
        getAdvertiserLead(lead.id),
        listAdvertiserAsRequests(lead.id),
        listAdvertiserNotes(lead.id),
      ]);
      setLead(l);
      setAsHistory(as);
      setNotes(n);
      onChanged(l);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "AS 요청에 실패했습니다.");
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
              {/* 상태 칩은 항상 전부 보여준다(2026-08-08 사용자 요청) — 무효도 목록에 있되
                  선택만 비활성(마케터 전용)이고, 무효·AS대기 리드도 현재 상태가 칩으로 표시된다. */}
              <div className="status-picker">
                {options.map((s) => {
                  const on = lead.statusKey === s.key;
                  // 비활성: 무효(마케터 전용) · AS요청(AS 접수로만) · 잠긴 리드(무효/AS대기) · 권한 없음
                  const disabled =
                    busy || locked || !canStatus || s.status === "INVALID" || s.status === "AS_REQUESTED";
                  return (
                    <button
                      key={s.key}
                      disabled={disabled}
                      style={disabled && !on ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
                      className={`chip ld-chip ld-${leadStatusClass(s.key)}${on ? " on" : ""}`}
                      title={
                        s.status === "INVALID"
                          ? "무효 처리·해제는 담당 마케터만 할 수 있습니다 (AS 요청을 이용하세요)"
                          : s.status === "AS_REQUESTED"
                            ? "AS요청은 아래 'AS 요청하기'로만 접수됩니다"
                            : s.status === "VALID"
                              ? "유효로 확정하면 계약 정산에 반영됩니다"
                              : undefined
                      }
                      onClick={() => onStatus(s)}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
              {lead.statusKey === "AS_REQUESTED" && (
                <p className="dash-sub" style={{ marginTop: 6 }}>
                  <strong>AS요청</strong> 처리 대기 중 — 담당자가 확인하면 결과가 AS 이력에 남습니다.
                </p>
              )}
              {lead.statusKey === "INVALID" && (
                <p className="dash-sub" style={{ marginTop: 6 }}>
                  <strong>무효</strong> 처리된 리드입니다 — 해제는 담당 마케터만 할 수 있습니다.
                </p>
              )}
              {!canStatus && (
                <p className="dash-sub" style={{ marginTop: 6 }}>상태 변경 권한이 없습니다.</p>
              )}
              <p className="dash-sub" style={{ fontSize: 12, marginTop: 6 }}>
                나만의 상태(상담중·부재중 등)는 <b>설정 → 진행상태 관리</b>에서 만들 수 있습니다.
              </p>

              {/* AS 요청 — 이 리드에 이의가 있을 때. 인정되면 무효(정산 제외)로 처리된다. */}
              {canStatus && !locked && (
                <>
                  <div className="card-h" style={{ marginTop: 20 }}>AS 요청</div>
                  {!asOpen ? (
                    <>
                      <p className="dash-sub" style={{ marginTop: 4 }}>
                        잘못 들어온 리드(결번·중복·허위 등)라면 사유와 증빙을 첨부해 요청하세요.
                        담당자가 인정하면 <b>무효</b>로 처리됩니다.
                      </p>
                      <button className="btn btn-ghost btn-sm" onClick={() => setAsOpen(true)}>
                        ⚠️ 이 리드에 AS 요청하기
                      </button>
                    </>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      <textarea
                        className="input"
                        rows={3}
                        value={asReason}
                        onChange={(e) => setAsReason(e.target.value)}
                        placeholder="요청 사유 (필수) — 예: 결번입니다 / 본인이 신청한 적 없다고 합니다"
                        maxLength={2000}
                        style={{ fontSize: 16 }}
                      />
                      {asFiles.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {asFiles.map((u) => (
                            <span key={u} style={{ position: "relative" }}>
                              <img src={u} alt="증빙" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }} />
                              <button
                                className="tag-x"
                                style={{ position: "absolute", top: -6, right: -6 }}
                                onClick={() => setAsFiles((prev) => prev.filter((x) => x !== u))}
                                aria-label="증빙 제거"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={uploading || asFiles.length >= 5}
                          onClick={() => fileRef.current?.click()}
                        >
                          {uploading ? "올리는 중…" : `증빙 이미지 첨부 (${asFiles.length}/5)`}
                        </button>
                        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onEvidenceFile} />
                        <button className="btn btn-primary btn-sm" disabled={busy || !asReason.trim()} onClick={submitAs}>
                          AS 요청 접수
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setAsOpen(false)}>취소</button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* AS 이력 */}
              {asHistory.length > 0 && (
                <>
                  <div className="card-h" style={{ marginTop: 20 }}>AS 이력</div>
                  <ul className="note-list">
                    {asHistory.map((r) => (
                      <li key={r.id} className="note">
                        <span className="note-body">
                          {r.status === "OPEN" ? "⏳ 처리 대기" : r.status === "ACCEPTED" ? "✅ 인정(무효 처리)" : "❌ 거부(유효 확정)"}
                          {" — "}
                          {r.reason}
                          {r.resolutionNote ? ` · 답변: ${r.resolutionNote}` : ""}
                        </span>
                        <span className="note-at">{new Date(r.createdAt).toLocaleString("ko-KR")}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className="card-h" style={{ marginTop: 20 }}>메모 · 이력</div>
              {notes.length === 0 ? (
                <p className="dash-sub">아직 메모가 없습니다.</p>
              ) : (
                <ul className="note-list">
                  {notes.map((n) => (
                    <li key={n.id} className={n.kind === "SYSTEM" ? "note sys" : "note"}>
                      <span className="note-body">
                        {/* 작성자 표기(2026-08-08 확정): 마케터/광고주 */}
                        {n.kind === "MEMO" && (
                          <strong style={{ marginRight: 6 }}>
                            {n.authorRole === "MARKETER" ? "[마케터]" : n.mine ? "[나]" : "[광고주]"}
                          </strong>
                        )}
                        {n.body}
                      </span>
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
