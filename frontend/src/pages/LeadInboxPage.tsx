import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  addLeadNote,
  bulkTrashLeads,
  bulkUpdateLeadStatus,
  getInbox,
  getLead,
  listLeadNotes,
  updateLeadStatus,
  LEAD_STATUSES,
  type InboxItem,
  type InboxResponse,
  type Lead,
  type LeadAnswer,
  type LeadNote,
} from "../api/client";
import { TopBar } from "../components/TopBar";
import { Pagination } from "../components/Pagination";

const PAGE_SIZE = 25;

/** 상태 → 라벨. */
function statusLabel(s: string): string {
  return LEAD_STATUSES.find((x) => x.value === s)?.label ?? s;
}

/** 답변에서 이름/연락처를 뽑아 목록에 요약 표시. */
function pickName(answers: LeadAnswer[]): string {
  const byLabel = answers.find((a) => /이름|성함|name/i.test(a.label));
  return (byLabel?.value || answers[0]?.value || "—").trim();
}
function pickPhone(answers: LeadAnswer[]): string | null {
  const byLabel = answers.find((a) => /연락처|전화|휴대|phone|tel/i.test(a.label));
  const cand = byLabel?.value || answers.find((a) => /01[016789][-\s]?\d{3,4}[-\s]?\d{4}/.test(a.value))?.value;
  return cand ? cand.trim() : null;
}
/** 목록에선 뒷자리를 가린다(개인정보). 상세 패널에선 전체 노출. */
function maskPhone(v: string): string {
  return v.replace(/(\d{2,4})[-\s]?(\d{3,4})[-\s]?(\d{4})/, (_m, a, b) => `${a}-${b}-··`);
}

/**
 * 통합 리드 인박스(U1) — 내 모든 리드폼의 리드를 한 곳에서.
 * 3-pane: 왼쪽 필터 rail · 가운데 목록 · 오른쪽 사이드 패널(상세). 넓은 프레임.
 * 폼별 뷰(/forms/:id/leads)는 그대로 유지되고, 이 페이지는 새 진입점으로 추가된다.
 */
export function LeadInboxPage() {
  // 필터 (rail)
  const [view, setView] = useState<"unseen" | "today" | "all">("unseen"); // 기본=미확인
  const [formFilter, setFormFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 사이드 패널
  const [openId, setOpenId] = useState<number | null>(null);
  // 일괄 선택
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setSelected(new Set()); // 목록이 바뀌면 선택 초기화(선택은 현재 화면 기준)
    try {
      const res = await getInbox({
        unseen: view === "unseen",
        from: view === "today" ? today : undefined,
        to: view === "today" ? today : undefined,
        status: statusFilter || undefined,
        formId: formFilter ?? undefined,
        q: q.trim() || undefined,
        page: page - 1,
        size: PAGE_SIZE,
      });
      setData(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [view, statusFilter, formFilter, q, page, today]);

  useEffect(() => {
    load();
  }, [load]);

  // 필터가 바뀌면 1페이지로
  useEffect(() => {
    setPage(1);
  }, [view, statusFilter, formFilter, q]);

  const counts = data?.counts;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setQ(qInput);
  }

  // 상태 변경 후 목록·패널 갱신
  async function onStatusChanged() {
    await load();
  }

  // ---- 일괄 선택 ----
  const pageIds = data?.items.map((i) => i.id) ?? [];
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleSelectAll() {
    setSelected((prev) => (pageIds.length > 0 && pageIds.every((id) => prev.has(id)) ? new Set() : new Set(pageIds)));
  }
  async function onBulkStatus(status: string) {
    if (selected.size === 0 || bulkBusy) return;
    setBulkBusy(true);
    setError("");
    try {
      await bulkUpdateLeadStatus([...selected], status);
      await load(); // 선택 초기화 포함
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "일괄 상태변경에 실패했습니다.");
    } finally {
      setBulkBusy(false);
    }
  }
  async function onBulkTrash() {
    if (selected.size === 0 || bulkBusy) return;
    if (!window.confirm(`${selected.size}건을 휴지통으로 이동할까요?`)) return;
    setBulkBusy(true);
    setError("");
    try {
      await bulkTrashLeads([...selected]);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "일괄 이동에 실패했습니다.");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <TopBar />
      <div className="inbox-shell">
        {/* ── PANE 1 · 필터 rail ── */}
        <aside className="inbox-rail">
          <form onSubmit={submitSearch}>
            <input
              className="input inbox-search"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="🔍 리드 검색 (이름·연락처 등)"
              onBlur={() => setQ(qInput)}
            />
          </form>

          <div className="rail-group">보기</div>
          <RailItem label="미확인" on={view === "unseen"} count={counts?.unseen} onClick={() => setView("unseen")} />
          <RailItem label="오늘" on={view === "today"} count={counts?.today} onClick={() => setView("today")} />
          <RailItem label="전체" on={view === "all"} count={counts?.all} onClick={() => setView("all")} />

          <div className="rail-group">상태</div>
          <RailItem label="전체 상태" on={statusFilter === ""} onClick={() => setStatusFilter("")} muted />
          {LEAD_STATUSES.map((s) => (
            <RailItem
              key={s.value}
              label={s.label}
              on={statusFilter === s.value}
              count={counts?.byStatus?.[s.value]}
              onClick={() => setStatusFilter(s.value)}
              dotClass={`ld-dot ld-${s.value}`}
            />
          ))}

          <div className="rail-group">출처 (리드폼)</div>
          <RailItem label="모든 폼" on={formFilter === null} onClick={() => setFormFilter(null)} muted />
          {(counts?.byForm ?? []).map((f) => (
            <RailItem
              key={f.formId}
              label={f.formName}
              on={formFilter === f.formId}
              count={f.count}
              onClick={() => setFormFilter(f.formId)}
            />
          ))}
        </aside>

        {/* ── PANE 2 · 목록 ── */}
        <main className="inbox-list">
          <div className="inbox-list-head">
            <h1 className="inbox-title">
              통합 인박스
              <span className="inbox-sub">
                {view === "unseen" ? "미확인" : view === "today" ? "오늘" : "전체"}
                {statusFilter && ` · ${statusLabel(statusFilter)}`}
                {formFilter !== null && counts?.byForm && ` · ${counts.byForm.find((f) => f.formId === formFilter)?.formName ?? ""}`}
                {` · ${data?.total?.toLocaleString() ?? 0}건`}
              </span>
            </h1>
          </div>

          {error && <p className="auth-error">{error}</p>}

          {/* 일괄 작업 툴바 */}
          {(data?.items.length ?? 0) > 0 && (
            <div className="inbox-bulk">
              <label className="bulk-check">
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                전체 선택
              </label>
              {selected.size > 0 ? (
                <div className="bulk-actions">
                  <span className="bulk-count">{selected.size}건 선택</span>
                  <select
                    className="input bulk-select"
                    value=""
                    disabled={bulkBusy}
                    onChange={(e) => e.target.value && onBulkStatus(e.target.value)}
                  >
                    <option value="">상태 변경…</option>
                    {LEAD_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}(으)로</option>
                    ))}
                  </select>
                  <button className="btn btn-ghost btn-sm" disabled={bulkBusy} onClick={onBulkTrash}>휴지통</button>
                  <button className="btn btn-ghost btn-sm" disabled={bulkBusy} onClick={() => setSelected(new Set())}>선택 해제</button>
                </div>
              ) : (
                <span className="bulk-hint">체크해서 여러 건을 한 번에 상태변경·정리하세요</span>
              )}
            </div>
          )}

          {loading && !data ? (
            <p className="inbox-empty">불러오는 중…</p>
          ) : (data?.items.length ?? 0) === 0 ? (
            <p className="inbox-empty">해당하는 리드가 없습니다.</p>
          ) : (
            <>
              <div className="inbox-rows" role="list">
                {data!.items.map((it) => (
                  <InboxRow
                    key={it.id}
                    item={it}
                    active={openId === it.id}
                    selected={selected.has(it.id)}
                    onOpen={() => setOpenId(it.id)}
                    onToggle={() => toggleSelect(it.id)}
                  />
                ))}
              </div>
              <div className="inbox-pager">
                <Pagination
                  total={data!.total}
                  page={page}
                  pages={pages}
                  pageSize={PAGE_SIZE}
                  onPage={setPage}
                  onPageSize={() => {}}
                />
              </div>
            </>
          )}
        </main>

        {/* ── PANE 3 · 사이드 패널(상세) ── */}
        {openId != null && (
          <LeadSidePanel leadId={openId} onClose={() => setOpenId(null)} onChanged={onStatusChanged} />
        )}
      </div>
    </div>
  );
}

/* ---------- rail item ---------- */
function RailItem({
  label, on, count, onClick, muted, dotClass,
}: {
  label: string; on: boolean; count?: number; onClick: () => void; muted?: boolean; dotClass?: string;
}) {
  return (
    <button type="button" className={`rail-item${on ? " on" : ""}${muted ? " muted" : ""}`} onClick={onClick}>
      <span className="rail-item-label">
        {dotClass && <span className={dotClass} />}
        {label}
      </span>
      {count != null && <span className="rail-count">{count.toLocaleString()}</span>}
    </button>
  );
}

/* ---------- list row ---------- */
function InboxRow({
  item, active, selected, onOpen, onToggle,
}: {
  item: InboxItem; active: boolean; selected: boolean; onOpen: () => void; onToggle: () => void;
}) {
  const phone = pickPhone(item.answers);
  const unread = item.status === "NEW";
  return (
    <div
      role="listitem"
      className={`inbox-row${active ? " active" : ""}${unread ? " unread" : ""}${selected ? " selected" : ""}`}
      onClick={onOpen}
    >
      {/* 체크박스: 행 열기와 분리(클릭 전파 차단) */}
      <label className="ir-check" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label="리드 선택" />
      </label>
      <span className="ir-name">
        {unread && <span className="ir-dot" />}
        {pickName(item.answers)}
      </span>
      <span className="ir-phone">{phone ? maskPhone(phone) : ""}</span>
      <span className="ir-src" title={item.formName}>{item.formName}</span>
      <span className={`pill ld-pill ld-${item.status}`}>{statusLabel(item.status)}</span>
      <span className="ir-time">{new Date(item.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}</span>
    </div>
  );
}

/* ---------- side panel (상세) ---------- */
function LeadSidePanel({ leadId, onClose, onChanged }: { leadId: number; onClose: () => void; onChanged: () => void }) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [l, n] = await Promise.all([getLead(leadId), listLeadNotes(leadId)]);
      setLead(l);
      setNotes(n);
    } catch {
      setLead(null);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function changeStatus(status: string) {
    if (!lead || status === lead.status) return;
    setBusy(true);
    try {
      await updateLeadStatus(leadId, status);
      await reload();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function submitMemo() {
    if (!memo.trim()) return;
    setBusy(true);
    try {
      await addLeadNote(leadId, memo.trim());
      setMemo("");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="inbox-panel">
      <div className="ip-head">
        <span className="ip-title">리드 상세</span>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>닫기 ✕</button>
      </div>

      {loading ? (
        <p className="inbox-empty">불러오는 중…</p>
      ) : !lead ? (
        <p className="inbox-empty">불러오지 못했습니다.</p>
      ) : (
        <div className="ip-body">
          {/* 답변 */}
          <div className="ip-section-label">답변</div>
          <div className="card card-pad ip-answers">
            {lead.answers.map((a) => (
              <div key={a.label} className="ip-answer">
                <span className="ip-k">{a.label}</span>
                <span className="ip-v">{a.value}</span>
              </div>
            ))}
          </div>

          {/* 방문자 정보 요약 */}
          {(lead.referer || lead.device) && (
            <>
              <div className="ip-section-label">방문자</div>
              <div className="card card-pad ip-answers">
                {lead.referer && <div className="ip-answer"><span className="ip-k">유입</span><span className="ip-v">{lead.referer}</span></div>}
                {lead.device && <div className="ip-answer"><span className="ip-k">기기</span><span className="ip-v">{[lead.device, lead.os, lead.browser].filter(Boolean).join(" · ")}</span></div>}
              </div>
            </>
          )}

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

          {/* 메모 / 이력 */}
          <div className="ip-section-label">메모 · 이력</div>
          {notes.length > 0 && (
            <ul className="ip-notes">
              {notes.map((n) => (
                <li key={n.id} className={`ip-note${n.kind === "SYSTEM" ? " sys" : ""}`}>
                  <span className="ip-note-meta">
                    {n.kind === "SYSTEM" ? "이력" : "메모"} · {new Date(n.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
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
            <a className="btn btn-ghost btn-sm" href={`/forms/${lead.formId}/leads`}>폼에서 열기 →</a>
            <button className="btn btn-primary btn-sm" onClick={submitMemo} disabled={busy || !memo.trim()}>메모 저장</button>
          </div>
        </div>
      )}
    </aside>
  );
}
