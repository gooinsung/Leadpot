import { useCallback, useEffect, useState } from "react";
import { Loading } from "../components/Loading";
import { Link } from "react-router-dom";
import {
  ApiError,
  bulkTrashLeads,
  bulkUpdateLeadStatus,
  markLeadsSeen,
  getInbox,
  getUtmFacets,
  type InboxItem,
  type InboxResponse,
} from "../api/client";
import { leadSource, sortUtmFacets, trackingKeyLabel, type UtmFacet } from "../lib/tracking";
import { TopBar } from "../components/TopBar";
import { LeadSidePanel } from "../components/LeadSidePanel";
import {
  leadStatusClass,
  leadStatusLabel as statusLabel,
  maskPhone,
  pickName,
  pickPhone,
  summarizeAnswers,
} from "../lib/leadDisplay";
import { useSelection } from "../lib/useSelection";

const PAGE_SIZE = 25;

/** "C{id}" 상태 키 → 일괄 변경 요청 값. 통합 축(V29). */
function keyToStatusBody(key: string): { status: string; customStatusId: number | null } {
  return key.startsWith("C")
    ? { status: "CUSTOM", customStatusId: Number(key.slice(1)) }
    : { status: key, customStatusId: null };
}

/** 좁은 화면(≤900px) 여부 — 스플릿 상세를 서랍으로 바꿀지 판정. */
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 900px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const on = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

/**
 * 통합 리드 인박스(U1) — 리디자인(가이드 §4)으로 3-pane rail 을 **스플릿 뷰**로 교체:
 * 목록 칼럼(430px: 검색·셀렉트 3개·세그먼트·카드 리스트·페이징) + 상세 pane(항상 표시).
 * 첫 진입 시 첫 리드를 자동 선택해 오른쪽이 비지 않는다. ≤900px 은 목록만 보이고
 * 행을 탭하면 상세가 서랍(전체 화면)으로 뜬다 — 기존 drawer 로직 재사용.
 */
export function LeadInboxPage() {
  // 세그먼트(전체/오늘/미확인) + 셀렉트 3개(상태/폼/기간)
  const [view, setView] = useState<"all" | "today" | "unseen">("all");
  const [statusFilter, setStatusFilter] = useState("");
  const [formFilter, setFormFilter] = useState<number | null>(null);
  // 분야 필터(V34) — 폼에 지정한 업종 구분(개인회생 등)으로 거른다. "오늘 개인회생 전반" 용.
  const [categoryFilter, setCategoryFilter] = useState("");
  const [range, setRange] = useState<"all" | "7d" | "30d">("all");
  // 유입 파라미터(출처) 필터 — "이름 선택 → 그 이름의 값 드롭다운" (faceted). '태그'와 별개 축.
  const [utmKey, setUtmKey] = useState("");
  const [utmValue, setUtmValue] = useState("");
  const [utmFacets, setUtmFacets] = useState<UtmFacet[]>([]);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 상세 선택. 데스크톱은 openId 가 없어도 첫 리드를 보여준다(자동 선택).
  const [openId, setOpenId] = useState<number | null>(null);
  const isNarrow = useIsNarrow();
  const [bulkBusy, setBulkBusy] = useState(false);

  const kstDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = kstDate(new Date());
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return kstDate(d);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getInbox({
        unseen: view === "unseen",
        // '오늘' 세그먼트는 오늘 하루로 고정, 그 외에는 기간 셀렉트를 쓴다.
        from: view === "today" ? today : range === "7d" ? daysAgo(6) : range === "30d" ? daysAgo(29) : undefined,
        to: view === "today" ? today : range === "all" ? undefined : today,
        status: statusFilter || undefined,
        formId: formFilter ?? undefined,
        category: categoryFilter || undefined,
        utmKey: utmKey || undefined,
        utmValue: utmValue || undefined,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, statusFilter, formFilter, categoryFilter, range, utmKey, utmValue, q, page]);

  useEffect(() => {
    load();
  }, [load]);

  // 유입 파라미터 facet(드롭다운 옵션) — 필터와 무관하게 폼 기준 전체라 폼이 바뀔 때만 다시 부른다.
  useEffect(() => {
    let alive = true;
    getUtmFacets(formFilter ?? undefined)
      .then((f) => { if (alive) setUtmFacets(sortUtmFacets(f)); })
      .catch(() => { if (alive) setUtmFacets([]); }); // 옵션 로드 실패는 조용히 — 목록은 그대로 쓴다
    return () => { alive = false; };
  }, [formFilter]);

  // 폼이 바뀌면 고른 유입 값이 그 폼에 없을 수 있다 → 유입 필터만 초기화
  useEffect(() => {
    setUtmKey("");
    setUtmValue("");
  }, [formFilter]);

  // 필터가 바뀌면 1페이지로
  useEffect(() => {
    setPage(1);
  }, [view, statusFilter, formFilter, categoryFilter, range, utmKey, utmValue, q]);

  const counts = data?.counts;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 전체선택(현재 페이지 기준, 2026-08-08) — 목록이 바뀌면 훅이 사라진 id 를 걷어낸다.
  const { selected, allSelected, toggle: toggleSelect, toggleAll, clear: clearSelection } =
    useSelection(items.map((i) => i.id));

  // 데스크톱: 선택이 없거나 목록 밖이면 첫 리드 자동 선택(오른쪽이 비지 않게).
  const selectedId = !isNarrow
    ? (openId != null && items.some((i) => i.id === openId) ? openId : items[0]?.id ?? null)
    : openId;

  function resetFilters() {
    setView("all");
    setStatusFilter("");
    setFormFilter(null);
    setCategoryFilter("");
    setRange("all");
    setUtmKey("");
    setUtmValue("");
    setQ("");
    setQInput("");
    setPage(1);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setQ(qInput);
  }

  async function onStatusChanged() {
    await load();
  }

  // ---- 일괄 작업 (선택 상태는 useSelection 훅) ----
  async function onBulkStatus(statusKey: string) {
    if (selected.size === 0 || bulkBusy) return;
    setBulkBusy(true);
    setError("");
    try {
      const { status, customStatusId } = keyToStatusBody(statusKey);
      await bulkUpdateLeadStatus([...selected], status, customStatusId);
      clearSelection();
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "일괄 상태변경에 실패했습니다.");
    } finally {
      setBulkBusy(false);
    }
  }
  /**
   * 리드를 열면서 '확인'으로 표시(V32).
   * 데스크톱에서 첫 리드가 자동 선택되는 것으로는 표시하지 않는다 —
   * <b>사용자가 직접 누른 것</b>만 봤다고 본다. 표시 실패는 무시(열람은 계속돼야 한다).
   */
  function openLead(id: number) {
    setOpenId(id);
    const item = items.find((i) => i.id === id);
    if (item && !item.seenAt) {
      markLeadsSeen([id]).then(() => load()).catch(() => {});
    }
  }

  /**
   * 선택한 리드를 '확인'으로 표시(V32). 리드 상태는 그대로 둔다 —
   * 미확인은 상태가 아니라 "내가 이 리드를 봤는지"다.
   */
  async function onBulkSeen() {
    if (selected.size === 0 || bulkBusy) return;
    setBulkBusy(true);
    setError("");
    try {
      await markLeadsSeen([...selected]);
      clearSelection();
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "확인 처리에 실패했습니다.");
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
      clearSelection();
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "일괄 이동에 실패했습니다.");
    } finally {
      setBulkBusy(false);
    }
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="app-shell">
      <TopBar />
      <div className="inbox-shell">
        {/* ── 목록 칼럼 (430px) ── */}
        <div className="il-col">
          <div className="il-head">
            <h1 className="il-title">리드</h1>
            <form onSubmit={submitSearch}>
              <input
                className="input il-search"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="이름·연락처·답변 검색"
                aria-label="리드 검색"
              />
            </form>
            <div className="il-selects">
              <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="상태 필터">
                <option value="">모든 상태</option>
                {Object.entries(counts?.statusNames ?? {}).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}{counts?.byStatus?.[key] != null ? ` ${counts.byStatus[key]}` : ""}
                  </option>
                ))}
              </select>
              <select
                className="input"
                value={formFilter ?? ""}
                onChange={(e) => setFormFilter(e.target.value ? Number(e.target.value) : null)}
                aria-label="리드폼 필터"
              >
                <option value="">모든 폼</option>
                {(counts?.byForm ?? []).map((f) => (
                  <option key={f.formId} value={f.formId}>
                    {f.formName} {f.count}
                  </option>
                ))}
              </select>
              {/* 분야 필터(V34) — 분야 지정된 폼이 하나도 없으면 숨긴다 */}
              {(counts?.byCategory?.length ?? 0) > 0 && (
                <select
                  className="input"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="분야 필터"
                >
                  <option value="">모든 분야</option>
                  {(counts?.byCategory ?? []).map((c) => (
                    <option key={c.name} value={c.name}>{c.name} {c.count}</option>
                  ))}
                </select>
              )}
              <select
                className="input"
                value={range}
                onChange={(e) => setRange(e.target.value as typeof range)}
                aria-label="기간 필터"
              >
                <option value="all">전체 기간</option>
                <option value="7d">최근 7일</option>
                <option value="30d">최근 30일</option>
              </select>
              {/* 유입(출처) 필터 — 파라미터 이름을 고르면 그 이름의 값 드롭다운이 열린다.
                  유입 파라미터가 붙은 리드가 하나도 없으면 통째로 숨긴다. */}
              {utmFacets.length > 0 && (
                <>
                  <select
                    className="input"
                    value={utmKey}
                    onChange={(e) => { setUtmKey(e.target.value); setUtmValue(""); }}
                    aria-label="유입 파라미터 선택"
                  >
                    <option value="">모든 유입</option>
                    {utmFacets.map((f) => (
                      <option key={f.key} value={f.key}>{trackingKeyLabel(f.key)}</option>
                    ))}
                  </select>
                  {utmKey && (
                    <select
                      className="input"
                      value={utmValue}
                      onChange={(e) => setUtmValue(e.target.value)}
                      aria-label="유입 값 선택"
                    >
                      <option value="">모든 값</option>
                      {(utmFacets.find((f) => f.key === utmKey)?.values ?? []).map((v) => (
                        <option key={v.value} value={v.value}>{v.value} ({v.count})</option>
                      ))}
                    </select>
                  )}
                </>
              )}
            </div>
            <div className="il-seg" role="tablist" aria-label="보기">
              {(
                [
                  ["all", "전체", counts?.all],
                  ["today", "오늘", counts?.today],
                  ["unseen", "미확인", counts?.unseen],
                ] as const
              ).map(([key, label, n]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={view === key}
                  className={view === key ? "on" : ""}
                  onClick={() => setView(key)}
                >
                  {label}{n != null ? ` ${n.toLocaleString()}` : ""}
                </button>
              ))}
            </div>
            {/* 일괄 작업 — 전체선택(현재 페이지)은 항상, 액션은 선택이 있을 때만(2026-08-08) */}
            {items.length > 0 && (
              <div className="il-bulk">
                <label className="bulk-check">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  전체 선택
                </label>
                {selected.size > 0 && (
                  <>
                    <span className="bulk-count">{selected.size}건</span>
                    <select
                      className="input bulk-select"
                      value=""
                      disabled={bulkBusy}
                      onChange={(e) => e.target.value && onBulkStatus(e.target.value)}
                      aria-label="일괄 상태 변경"
                    >
                      <option value="">상태 변경…</option>
                      {Object.entries(counts?.statusNames ?? {})
                        .filter(([key]) => key !== "AS_REQUESTED")
                        .map(([key, label]) => (
                          <option key={key} value={key}>{label}(으)로</option>
                        ))}
                    </select>
                    <button className="btn btn-ghost btn-sm" disabled={bulkBusy} onClick={onBulkSeen}>확인으로 변경</button>
                    <button className="btn btn-ghost btn-sm" disabled={bulkBusy} onClick={onBulkTrash}>휴지통</button>
                    <button className="btn btn-ghost btn-sm" disabled={bulkBusy} onClick={clearSelection}>해제</button>
                  </>
                )}
              </div>
            )}
          </div>

          {error && <p className="auth-error" style={{ margin: "10px 20px" }}>{error}</p>}

          <div className="il-list" role="list">
            {loading && !data ? (
              <Loading />
            ) : items.length === 0 ? (
              <div className="il-empty">
                {(counts?.all ?? 0) === 0 ? (
                  <>
                    <p>아직 접수된 리드가 없습니다.</p>
                    <Link className="btn btn-primary btn-sm" to="/forms">리드폼 보러 가기</Link>
                  </>
                ) : (
                  <>
                    <p>조건에 맞는 리드가 없습니다.</p>
                    <button className="btn btn-ghost btn-sm" onClick={resetFilters}>필터 초기화</button>
                  </>
                )}
              </div>
            ) : (
              items.map((it) => (
                <InboxCard
                  key={it.id}
                  item={it}
                  statusNames={counts?.statusNames}
                  active={selectedId === it.id}
                  checked={selected.has(it.id)}
                  onOpen={() => openLead(it.id)}
                  onToggle={() => toggleSelect(it.id)}
                />
              ))
            )}
          </div>

          <div className="il-foot">
            <span className="tnum">{rangeStart}–{rangeEnd} / {total.toLocaleString()}</span>
            <div className="il-foot-btns">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="이전 페이지"
              >
                ←
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                aria-label="다음 페이지"
              >
                →
              </button>
            </div>
          </div>
        </div>

        {/* ── 상세 pane (데스크톱 상시 표시) ── */}
        {!isNarrow && (
          <div className="inbox-detail">
            {selectedId != null ? (
              <LeadSidePanel
                key={selectedId}
                leadId={selectedId}
                variant="pane"
                formName={items.find((i) => i.id === selectedId)?.formName}
                onClose={() => setOpenId(null)}
                onChanged={onStatusChanged}
                showFormLink
              />
            ) : (
              <div className="il-empty" style={{ paddingTop: 80 }}>
                <p>왼쪽에서 리드를 선택하면 여기에 상세가 표시됩니다.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ≤900px: 행 탭 → 상세 서랍(전체 화면) */}
      {isNarrow && openId != null && (
        <LeadSidePanel
          leadId={openId}
          variant="drawer"
          formName={items.find((i) => i.id === openId)?.formName}
          onClose={() => setOpenId(null)}
          onChanged={onStatusChanged}
          showFormLink
        />
      )}
    </div>
  );
}

/* ---------- 목록 카드 (2줄: 이름+상태+시각 / 연락처+요약) ---------- */
function InboxCard({
  item, statusNames, active, checked, onOpen, onToggle,
}: {
  item: InboxItem;
  statusNames?: Record<string, string>;
  active: boolean;
  checked: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const phone = pickPhone(item.answers);
  // 출처 칩 — media_from(자체) 우선, 없으면 utm source. 없으면 안 그린다.
  const source = leadSource(item.utm);
  // 미확인 = 내가 아직 안 연 리드(V32). 예전엔 status === "NEW" 였는데
  // 상태는 광고주도 바꾸는 축이라 '내가 봤는지'와 섞이면 안 된다.
  const unread = !item.seenAt;
  return (
    <div
      role="listitem"
      className={`il-row${active ? " on" : ""}${unread ? " unread" : ""}${checked ? " checked" : ""}`}
      onClick={onOpen}
    >
      <div className="il-row-top">
        <label className="il-check" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={checked} onChange={onToggle} aria-label="리드 선택" />
        </label>
        {unread && <span className="ir-dot" />}
        <span className="il-name">{pickName(item.answers)}</span>
        <span className={`il-st pill ld-pill ld-${leadStatusClass(item.statusKey)}`}>
          {statusLabel(item.statusKey, statusNames)}
        </span>
        <span className="il-time">
          {new Date(item.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
        </span>
      </div>
      <div className="il-row-sub">
        <span className="tnum" style={{ flex: "none" }}>{phone ? maskPhone(phone) : "—"}</span>
        {item.formCategory && (
          <span className="il-cat" title={`분야: ${item.formCategory} (${item.formName})`}>{item.formCategory}</span>
        )}
        {source && (
          <span
            className="il-src"
            title={Object.entries(item.utm ?? {}).map(([k, v]) => `${trackingKeyLabel(k)}=${v}`).join(" · ")}
          >
            {source}
          </span>
        )}
        <span className="il-summary">{summarizeAnswers(item.answers, [pickName(item.answers), phone])}</span>
      </div>
    </div>
  );
}
