import { useCallback, useEffect, useRef, useState } from "react";
import { Loading } from "../components/Loading";
import { useSearchParams } from "react-router-dom";
import {
  ApiError,
  downloadAdvertiserLeads,
  getAdvertiserDashboard,
  getAdvertiserLeadUpdates,
  getAdvertiserMe,
  getAdvertiserStatusOptions,
  listAdvertiserForms,
  listAdvertiserLeads,
  updateAdvertiserLeadStatus,
  type AdvertiserDashboard,
  type AdvertiserForm,
  type AdvertiserLead,
  type AdvertiserMe,
  type LeadStatusOption,
} from "../api/client";
import { AdvertiserTopBar } from "../components/AdvertiserTopBar";
import { AdvertiserLeadDetail } from "../components/AdvertiserLeadDetail";
import { Pagination } from "../components/Pagination";
import { leadStatusClass } from "../lib/leadDisplay";

/** 서버가 한 번에 내려주는 최대 건수(백엔드 MAX_PAGE_SIZE 와 일치). '전체' 선택 시 이 값을 쓴다. */
const SERVER_MAX = 100;

/** 상태별 색상 클래스 — 마케터와 같은 .ld-* 한 벌(통합 축 V29). */
function statusClass(statusKey: string) {
  return `ld-${leadStatusClass(statusKey)}`;
}

/** 답변에서 연락처처럼 보이는 값을 찾아 전화 링크용 숫자만 남긴다. */
function phoneOf(lead: AdvertiserLead): string | null {
  const hit = lead.answers.find((a) => /연락처|전화|휴대|폰|phone|tel|mobile/i.test(a.label ?? ""));
  const digits = hit?.value?.replace(/[^0-9+]/g, "") ?? "";
  return digits.length >= 8 ? digits : null;
}

/**
 * 광고주 리드 목록. 마케터 리드 목록과 같은 구조(답변 인라인 표시 · 검색 · 상태/기간 필터 · 페이징)로 맞추고,
 * 광고주 전용 요소(전화 버튼 · 미확인 강조)를 더했다. 모바일에서도 그대로 쓸 수 있게 반응형.
 */
export function AdvertiserLeadsPage() {
  // 텔레그램 알림 딥링크(/client?form=..&lead=..)로 들어오면 해당 폼·리드를 바로 연다.
  const [searchParams] = useSearchParams();
  const [forms, setForms] = useState<AdvertiserForm[]>([]);
  const [formId, setFormId] = useState<number | null>(null);
  const [dash, setDash] = useState<AdvertiserDashboard | null>(null);
  // 통합 상태 축(V29): 고정 4 + 내 커스텀. 무효는 마케터 전용이라 변경 셀렉트에서 뺀다.
  const [statusOptions, setStatusOptions] = useState<LeadStatusOption[]>([]);
  // 인사 헤더("OO님, 새 리드 N건이 기다려요")용 내 정보 — 리디자인 §9
  const [me, setMe] = useState<AdvertiserMe | null>(null);
  useEffect(() => {
    getAdvertiserStatusOptions().then(setStatusOptions).catch(() => setStatusOptions([]));
    getAdvertiserMe().then(setMe).catch(() => {});
  }, []);

  const [leads, setLeads] = useState<AdvertiserLead[]>([]);
  const [total, setTotal] = useState(0);

  // 필터
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [unseenOnly, setUnseenOnly] = useState(false);

  // 페이징 (서버 페이징 — Pagination 컴포넌트는 1-base, API 는 0-base)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  // 실시간 폴링(A6): 유휴 상태(1페이지·필터 없음·상세 닫힘)면 자동 갱신, 아니면 새로고침 배너.
  const [newCount, setNewCount] = useState(0);
  const sinceRef = useRef<string | null>(null);
  const lastServerRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [f, d] = await Promise.all([listAdvertiserForms(), getAdvertiserDashboard()]);
        setForms(f);
        setDash(d);
        if (f.length > 0) {
          // 딥링크의 form 이 내가 부여받은 폼이면 그것을, 아니면 첫 폼을 연다.
          const wantForm = Number(searchParams.get("form"));
          const matched = f.find((x) => x.formId === wantForm);
          setFormId(matched ? matched.formId : f[0].formId);
          const wantLead = Number(searchParams.get("lead"));
          if (wantLead > 0) setOpenId(wantLead);
        } else setLoading(false);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "불러오지 못했습니다.");
        setLoading(false);
      }
    })();
  }, []);

  const effectiveSize = pageSize === -1 ? SERVER_MAX : pageSize;

  const load = useCallback(async () => {
    if (formId == null) return;
    setLoading(true);
    setError("");
    try {
      const res = await listAdvertiserLeads({
        formId,
        status: statusFilter || undefined,
        q: q.trim() || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        page: page - 1,
        size: effectiveSize,
      });
      setLeads(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [formId, statusFilter, q, dateFrom, dateTo, page, effectiveSize]);

  useEffect(() => {
    load();
  }, [load]);

  // 필터가 바뀌면 1페이지로
  useEffect(() => {
    setPage(1);
  }, [formId, statusFilter, q, dateFrom, dateTo, pageSize]);

  const refreshCounts = useCallback(async () => {
    try {
      const [f, d] = await Promise.all([listAdvertiserForms(), getAdvertiserDashboard()]);
      setForms(f);
      setDash(d);
    } catch {
      // 카운트 갱신 실패는 화면을 막지 않는다
    }
  }, []);

  function applyUpdated(updated: AdvertiserLead) {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    refreshCounts();
  }

  // 인터벌 콜백이 최신 상태·함수를 stale 없이 읽도록 ref 로 보관.
  const pollCtx = useRef({ page, hasOpen: openId != null, filtered: false });
  const reloadRef = useRef<() => Promise<void>>(async () => {});
  reloadRef.current = async () => {
    await load();
    await refreshCounts();
  };

  // 30초 폴링. formId 가 바뀌면 기준선(since)을 다시 잡는다.
  useEffect(() => {
    if (formId == null) return;
    sinceRef.current = null;
    lastServerRef.current = null;
    setNewCount(0);
    let alive = true;

    async function poll() {
      if (formId == null) return;
      try {
        const res = await getAdvertiserLeadUpdates(formId, sinceRef.current ?? undefined);
        if (!alive) return;
        lastServerRef.current = res.serverTime;
        if (sinceRef.current == null) {
          sinceRef.current = res.serverTime; // 최초 호출 = 기준선만
          return;
        }
        if (res.newCount <= 0) return;
        const ctx = pollCtx.current;
        if (ctx.page === 1 && !ctx.filtered && !ctx.hasOpen) {
          // 유휴 상태 → 조용히 자동 갱신하고 기준선 전진
          await reloadRef.current();
          if (!alive) return;
          sinceRef.current = res.serverTime;
          setNewCount(0);
        } else {
          // 사용자가 보고 있는 화면을 흔들지 않도록 배너로만 알림(기준선 유지 → 누적 카운트)
          setNewCount(res.newCount);
        }
      } catch {
        // 폴링 실패는 조용히 무시(다음 주기에 재시도)
      }
    }

    poll();
    const id = window.setInterval(poll, 30000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
    // formId 가 바뀔 때만 기준선을 다시 잡는다. load/refreshCounts 는 reloadRef 로 최신을 참조.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  // '새로고침' 배너 클릭 → 지금 목록을 다시 불러오고 기준선을 최신으로 전진.
  async function onRefreshNew() {
    await reloadRef.current();
    sinceRef.current = lastServerRef.current ?? sinceRef.current;
    setNewCount(0);
  }

  async function onStatusChange(lead: AdvertiserLead, nextKey: string) {
    if (nextKey === lead.statusKey) return;
    const opt = statusOptions.find((o) => o.key === nextKey);
    if (!opt) return;
    setBusyId(lead.id);
    try {
      applyUpdated(await updateAdvertiserLeadStatus(lead.id, opt.status, opt.customStatusId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "상태 변경에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  const currentForm = forms.find((f) => f.formId === formId) ?? null;
  const shown = unseenOnly ? leads.filter((l) => !l.advertiserSeenAt) : leads;
  const pages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const hasFilter = !!(q || statusFilter || dateFrom || dateTo || unseenOnly);

  /** 지금 보고 있는 리드폼의 미확인 건수(폼이 하나면 그 폼, 여러 개면 선택한 폼). */
  const unseenCount = currentForm?.unseenCount ?? 0;
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  /**
   * 할 일 큐 클릭 — 조건을 '더하지' 않고 그 할 일만 남긴다.
   * 여러 필터가 겹쳐 왜 안 보이는지 헷갈리는 일을 막는다.
   */
  function applyTask(task: "unseen" | "today" | "all") {
    setQ("");
    setStatusFilter("");
    setPage(1);
    setUnseenOnly(task === "unseen");
    setDateFrom(task === "today" ? today : "");
    setDateTo(task === "today" ? today : "");
  }
  // 폴링 콜백이 최신 화면 상태를 읽도록 매 렌더마다 갱신.
  pollCtx.current = { page, hasOpen: openId != null, filtered: hasFilter };

  // 현재 화면 필터를 그대로 반영해 내보낸다. 실패(권한·일일상한)는 알림으로 보여준다.
  async function onExport(format: "xlsx" | "csv") {
    if (formId == null || exporting) return;
    setExporting(true);
    setError("");
    try {
      await downloadAdvertiserLeads(formId, {
        format,
        status: statusFilter || undefined,
        q: q.trim() || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        formName: currentForm?.name || "leads",
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "내보내기에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="app-shell">
      <AdvertiserTopBar />
      <main className="wrap dashboard client-wrap">
        {newCount > 0 && (
          <button type="button" className="unseen-banner" onClick={onRefreshNew}>
            <span className="unseen-dot" />
            새 리드 <strong>{newCount}건</strong>이 접수되었습니다
            <span className="unseen-go">새로고침 →</span>
          </button>
        )}

        {dash && dash.unseenLeads > 0 && (
          <button type="button" className="unseen-banner" onClick={() => setUnseenOnly(true)}>
            <span className="unseen-dot" />
            확인하지 않은 리드 <strong>{dash.unseenLeads}건</strong>이 있습니다
            <span className="unseen-go">보기 →</span>
          </button>
        )}

        <div className="dash-head">
          <div>
            <p className="eyebrow">접수 내역</p>
            {/* 리디자인 §9: 할 일 문구로 인사 — 미확인이 없으면 차분하게 */}
            <h1 className="dash-title">
              {(dash?.unseenLeads ?? 0) > 0
                ? `${me ? `${me.company || me.name} 님, ` : ""}새 리드 ${dash!.unseenLeads}건이 기다려요`
                : `${me ? `${me.company || me.name} 님, ` : ""}접수된 리드를 확인하세요`}
            </h1>
            <p className="dash-sub">
              {currentForm
                ? `${currentForm.name} · 총 ${currentForm.leadCount.toLocaleString()}건${
                    currentForm.unseenCount > 0 ? ` · 미확인 ${currentForm.unseenCount}건` : ""
                  }`
                : "담당 마케터가 권한을 부여한 리드폼의 접수 내역입니다."}
            </p>
          </div>
        </div>

        {/* 할 일 큐(U6 Task-First) — 숫자를 보여주기만 하지 않고 누르면 바로 그 목록으로 간다.
            광고주가 로그인해서 가장 먼저 할 일은 '미확인 처리'다. */}
        {dash && forms.length > 0 && (
          <div className="task-queue">
            <button
              type="button"
              className={`task-card${unseenOnly ? " on" : ""}${unseenCount > 0 ? " urgent" : ""}`}
              onClick={() => applyTask("unseen")}
            >
              <span className="task-label">미확인</span>
              <span className="task-val">{unseenCount}</span>
              <span className="task-hint">{unseenCount > 0 ? "먼저 확인하세요" : "모두 확인했습니다"}</span>
            </button>
            <button
              type="button"
              className={`task-card${dateFrom === today && dateTo === today ? " on" : ""}`}
              onClick={() => applyTask("today")}
            >
              <span className="task-label">오늘 접수</span>
              <span className="task-val">{dash.todayLeads}</span>
              <span className="task-hint">오늘 들어온 리드</span>
            </button>
            <button
              type="button"
              className={`task-card${!hasFilter ? " on" : ""}`}
              onClick={() => applyTask("all")}
            >
              <span className="task-label">전체</span>
              <span className="task-val">{dash.totalLeads}</span>
              <span className="task-hint">받은 리드 전부</span>
            </button>
          </div>
        )}

        {forms.length === 0 && !loading && !error && (
          <div className="card card-pad empty-state">
            <p>아직 열람 권한을 받은 리드폼이 없습니다.</p>
            <p className="dash-sub">담당 마케터에게 문의해주세요.</p>
          </div>
        )}

        {/* 리드폼 선택 (부여받은 폼별) */}
        {forms.length > 1 && (
          <div className="client-forms">
            {forms.map((f) => (
              <button
                key={f.formId}
                className={f.formId === formId ? "chip on" : "chip"}
                onClick={() => {
                  setFormId(f.formId);
                  setUnseenOnly(false);
                }}
              >
                {f.name}
                {f.unseenCount > 0 && <span className="chip-badge">{f.unseenCount}</span>}
              </button>
            ))}
          </div>
        )}

        {/* 검색·필터 (마케터 리드 목록과 동일한 구성) */}
        {forms.length > 0 && (
          <div className="card card-pad adv-filters">
            <input
              className="input"
              style={{ maxWidth: 280 }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="검색 (이름·연락처 등 답변 내용)"
            />
            <select
              className="input"
              style={{ width: 140 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">상태 전체</option>
              {statusOptions.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }} title="접수일시(KST) 범위로 검색">
              <input
                className="input"
                type="date"
                style={{ width: 150 }}
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="접수 시작일"
              />
              <span className="dash-sub" style={{ fontSize: 12 }}>~</span>
              <input
                className="input"
                type="date"
                style={{ width: 150 }}
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="접수 종료일"
              />
            </div>
            <button
              className={`btn btn-sm ${unseenOnly ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setUnseenOnly((v) => !v)}
            >
              미확인만
            </button>
            {hasFilter && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setQ("");
                  setStatusFilter("");
                  setDateFrom("");
                  setDateTo("");
                  setUnseenOnly(false);
                }}
              >
                필터 초기화
              </button>
            )}
            {currentForm?.canExport && (
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => onExport("xlsx")} disabled={exporting}>
                  {exporting ? "내보내는 중…" : "엑셀"}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => onExport("csv")} disabled={exporting}>
                  CSV
                </button>
              </div>
            )}
          </div>
        )}

        {error && <p className="auth-error">{error}</p>}

        {loading ? (
          <Loading />
        ) : forms.length === 0 ? null : shown.length === 0 ? (
          <div className="card card-pad empty-state">
            <p>{hasFilter ? "조건에 맞는 리드가 없습니다." : "아직 접수된 리드가 없습니다."}</p>
          </div>
        ) : (
          <>
            <div className="leads">
              {shown.map((lead) => {
                const phone = phoneOf(lead);
                const unseen = !lead.advertiserSeenAt;
                return (
                  <div className={`card card-pad lead-card${unseen ? " adv-unseen" : ""}`} key={lead.id}>
                    <div className="lead-head">
                      <span className="lead-time">
                        {new Date(lead.createdAt).toLocaleString("ko-KR")}
                        {unseen && (
                          <span className="badge b-wait" style={{ marginLeft: 8 }}>
                            미확인
                          </span>
                        )}
                      </span>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        {/* 광고주의 첫 행동은 대부분 '전화 걸기' — 그린 soft pill + 번호 표시(리디자인 §9) */}
                        {phone && (
                          <a className="btn btn-sm call-btn call-btn-soft" href={`tel:${phone}`}>
                            📞 {phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3")}
                          </a>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => setOpenId(lead.id)}>
                          상세
                        </button>
                        {currentForm?.canStatus && lead.statusKey !== "AS_REQUESTED" && lead.statusKey !== "INVALID" ? (
                          <select
                            className={`lead-status-select ${statusClass(lead.statusKey)}`}
                            value={lead.statusKey}
                            disabled={busyId === lead.id}
                            onChange={(e) => onStatusChange(lead, e.target.value)}
                          >
                            {/* 무효·AS요청도 보이되 선택 불가(무효=마케터 전용, AS요청=상세의 접수로만) */}
                            {statusOptions.map((s) => (
                              <option
                                key={s.key}
                                value={s.key}
                                disabled={s.status === "INVALID" || s.status === "AS_REQUESTED"}
                              >
                                {s.label}
                                {s.status === "INVALID" ? " (담당자 전용)" : ""}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`pill ld-pill ${statusClass(lead.statusKey)}`}>{lead.statusLabel}</span>
                        )}
                      </div>
                    </div>
                    <div className="lead-answers">
                      {lead.answers.map((a, i) => (
                        <div className="lead-answer" key={i}>
                          <span className="lead-a-label">{a.label}</span>
                          <span className="lead-a-value">{a.value || "-"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {!unseenOnly && (
              <Pagination
                total={total}
                page={page}
                pages={pages}
                pageSize={pageSize}
                onPage={setPage}
                onPageSize={setPageSize}
              />
            )}
            {unseenOnly && (
              <p className="dash-sub" style={{ marginTop: 12, fontSize: 13 }}>
                현재 페이지에서 미확인 {shown.length}건만 보고 있습니다. 전체를 보려면 '미확인만'을 해제하세요.
              </p>
            )}
            {pageSize === -1 && total > SERVER_MAX && (
              <p className="dash-sub" style={{ marginTop: 8, fontSize: 12 }}>
                ⓘ 한 번에 최대 {SERVER_MAX}건까지 표시됩니다(총 {total.toLocaleString()}건). 기간·검색으로 좁혀서
                확인해주세요.
              </p>
            )}
          </>
        )}
      </main>

      {openId != null && (
        <AdvertiserLeadDetail
          leadId={openId}
          canStatus={currentForm?.canStatus ?? false}
          canMemo={currentForm?.canMemo ?? false}
          onClose={() => setOpenId(null)}
          onChanged={applyUpdated}
        />
      )}
    </div>
  );
}
