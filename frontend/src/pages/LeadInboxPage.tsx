import { useCallback, useEffect, useState } from "react";
import { Loading } from "../components/Loading";
import { Link } from "react-router-dom";
import {
  ApiError,
  bulkTrashLeads,
  bulkUpdateLeadStatus,
  getInbox,
  LEAD_STATUSES,
  type InboxItem,
  type InboxResponse,
} from "../api/client";
import { TopBar } from "../components/TopBar";
import { Pagination } from "../components/Pagination";
import { LeadSidePanel } from "../components/LeadSidePanel";
import { leadStatusLabel as statusLabel, maskPhone, pickName, pickPhone, summarizeAnswers } from "../lib/leadDisplay";

const PAGE_SIZE = 25;

/**
 * 통합 리드 인박스(U1) — 내 모든 리드폼의 리드를 한 곳에서.
 * 3-pane: 왼쪽 필터 rail · 가운데 목록 · 오른쪽 사이드 패널(상세). 넓은 프레임.
 * 폼별 뷰(/forms/:id/leads)는 그대로 유지되고, 이 페이지는 새 진입점으로 추가된다.
 */
export function LeadInboxPage() {
  // 필터 (rail)
  const [view, setView] = useState<"unseen" | "today" | "all">("all"); // 기본=전체(사용자 결정)
  const [formFilter, setFormFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
        // '오늘' 보기는 오늘 하루로 고정, 그 외에는 사용자가 고른 기간을 쓴다.
        from: view === "today" ? today : dateFrom || undefined,
        to: view === "today" ? today : dateTo || undefined,
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
  }, [view, statusFilter, formFilter, q, dateFrom, dateTo, page, today]);

  useEffect(() => {
    load();
  }, [load]);

  // 필터가 바뀌면 1페이지로
  useEffect(() => {
    setPage(1);
  }, [view, statusFilter, formFilter, q, dateFrom, dateTo]);

  const counts = data?.counts;

  /** 빈 화면에서 한 번에 필터를 걷어낸다(어떤 조건 때문에 비었는지 찾아 헤매지 않게). */
  function resetFilters() {
    setView("all");
    setStatusFilter("");
    setFormFilter(null);
    setQ("");
    setQInput(""); // 검색창 표시도 같이 비운다(안 그러면 글자가 남아 걸린 줄 안다)
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  /** 날짜를 고르면 '오늘' 보기에서 빠져나온다 — 둘이 겹치면 어느 쪽이 걸린 건지 알 수 없다. */
  function pickDate(which: "from" | "to", value: string) {
    if (which === "from") setDateFrom(value);
    else setDateTo(value);
    if (view === "today") setView("all");
  }
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

          {/* 기간 — '오늘' 보기와 겹치지 않게, 날짜를 고르면 보기를 '전체'로 넘긴다 */}
          <div className="rail-group">기간</div>
          <div className="rail-dates" title="접수일시(KST) 범위로 검색">
            <input
              className="input"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => pickDate("from", e.target.value)}
              aria-label="접수 시작일"
            />
            <span className="rail-dates-sep">~</span>
            <input
              className="input"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => pickDate("to", e.target.value)}
              aria-label="접수 종료일"
            />
          </div>

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
            <Loading />
          ) : (data?.items.length ?? 0) === 0 ? (
            /* 리드가 아예 없는 것과 필터에 걸려 안 보이는 것은 해야 할 일이 다르다 — 구분해서 안내한다. */
            <div className="card card-pad empty-state">
              {(counts?.all ?? 0) === 0 ? (
                <>
                  <p>아직 접수된 리드가 없습니다.</p>
                  <p className="dash-sub" style={{ marginTop: -6 }}>
                    리드폼을 만들어 공개하면 접수된 리드가 여기에 모입니다.
                  </p>
                  <Link className="btn btn-primary" to="/forms">
                    리드폼 보러 가기
                  </Link>
                </>
              ) : (
                <>
                  <p>조건에 맞는 리드가 없습니다.</p>
                  <button className="btn btn-ghost" onClick={resetFilters}>
                    필터 초기화
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="inbox-rows" role="list">
                {/* 열 제목 — 폼별 목록과 같은 방식으로 스캔을 돕는다(열 폭은 .inbox-row 와 공유) */}
                <div className="inbox-head" aria-hidden="true">
                  <span />
                  <span>이름</span>
                  <span>연락처</span>
                  <span>답변 요약</span>
                  <span>출처</span>
                  <span>상태</span>
                  <span>접수일시</span>
                </div>
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

        {/* 상세는 목록 위로 겹쳐 나왔다 들어가는 서랍(사용자 결정) —
            칸을 미리 비워두지 않으므로 목록이 항상 화면 폭을 다 쓴다. */}
        {openId != null && (
          <LeadSidePanel
            leadId={openId}
            variant="drawer"
            formName={data?.items.find((i) => i.id === openId)?.formName}
            onClose={() => setOpenId(null)}
            onChanged={onStatusChanged}
            showFormLink
          />
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
      {/* 이름·연락처를 뺀 나머지 답변 한 줄 요약 — 폼별 목록과 같은 규칙(lib/leadDisplay) */}
      <span className="ir-summary">{summarizeAnswers(item.answers, [pickName(item.answers), phone])}</span>
      <span className="ir-src" title={item.formName}>{item.formName}</span>
      <span className={`pill ld-pill ld-${item.status}`}>{statusLabel(item.status)}</span>
      <span className="ir-time">{new Date(item.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}</span>
    </div>
  );
}

