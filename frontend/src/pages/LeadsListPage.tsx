import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  advertiserStatusLabel,
  ApiError,
  deleteLead,
  downloadLeads,
  downloadLeadTemplate,
  getForm,
  getLeadColumns,
  importLeads,
  LEAD_STATUSES,
  listLeads,
  permanentDeleteLead,
  restoreLead,
  updateLeadStatus,
  type FormDetail,
  type Lead,
} from "../api/client";
import { TopBar } from "../components/TopBar";
import { LeadSidePanel } from "../components/LeadSidePanel";
import { Pagination, usePaging } from "../components/Pagination";
import { leadStatusLabel, maskPhone, pickName, pickPhone, summarizeAnswers } from "../lib/leadDisplay";

// ISO 타임스탬프 → KST 기준 YYYY-MM-DD (날짜 범위 필터 비교용)
function kstDate(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

export function LeadsListPage() {
  const { id } = useParams();
  const formId = Number(id);
  const navigate = useNavigate();
  const [form, setForm] = useState<FormDetail | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [trashed, setTrashed] = useState(false); // 휴지통 보기 여부
  const [statusFilter, setStatusFilter] = useState(""); // "" = 전체
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState(""); // 접수일시 시작(YYYY-MM-DD, KST). "" = 제한 없음
  const [dateTo, setDateTo] = useState(""); // 접수일시 끝(포함)
  const [showEmbed, setShowEmbed] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [dupOnly, setDupOnly] = useState(false); // 중복만 보기
  const [advUnseenOnly, setAdvUnseenOnly] = useState(false); // 광고주 미확인만 보기
  const [tagFilter, setTagFilter] = useState(""); // "" = 전체 태그
  const [detailId, setDetailId] = useState<number | null>(null); // 상세 사이드 패널 대상(U2: 모달 → 패널)
  const fileRef = useRef<HTMLInputElement>(null);
  // 내보내기 모달(형식·컬럼 선택)
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv">("xlsx");
  const [exportCols, setExportCols] = useState<string[]>([]); // 선택 가능한 전체 컬럼
  const [exportSel, setExportSel] = useState<string[]>([]); // 선택된 컬럼
  const [exporting, setExporting] = useState(false);

  function openExport() {
    setExportOpen(true);
    getLeadColumns(formId)
      .then((cols) => {
        setExportCols(cols);
        setExportSel(cols); // 기본: 전체 선택
      })
      .catch(() => {});
  }

  function toggleExportCol(col: string) {
    setExportSel((sel) => (sel.includes(col) ? sel.filter((c) => c !== col) : [...sel, col]));
  }

  async function runExport() {
    if (exportSel.length === 0) return;
    setExporting(true);
    try {
      // 선택 순서가 아니라 원래 컬럼 순서를 유지해 보냄
      const ordered = exportCols.filter((c) => exportSel.includes(c));
      // 현재 화면 필터(날짜·검색·상태·태그·중복)가 적용된 리드만 내보낸다.
      const ids = filtered.map((l) => l.id);
      await downloadLeads(formId, { format: exportFormat, columns: ordered, ids, formName: form?.name || "leads" });
      setExportOpen(false);
    } catch {
      alert("내보내기에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setExporting(false);
    }
  }

  const publicUrl = `${window.location.origin}/f/${formId}`;
  // 외부 사이트 임베드 스니펫(M6): 대상 페이지에 붙여넣으면 embed.js 가 해당 위치에 리드폼을 렌더.
  const embedSnippet = `<div data-leadpot-form="${formId}"></div>\n<script src="${window.location.origin}/embed.js" async></script>`;

  function copyEmbed() {
    navigator.clipboard?.writeText(embedSnippet).then(() => {
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 1500);
    });
  }

  function load() {
    setLoading(true);
    listLeads(formId, { trashed })
      .then(setLeads)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    getForm(formId).then(setForm).catch(() => {});
  }, [formId]);

  // 휴지통/일반 전환 시 목록 재조회
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, trashed]);

  // 중복 판정 기준 항목: 리드폼에서 '중복 방지'(allowDuplicate=false)로 설정된 FIELD 라벨
  const uniqueFieldLabels = useMemo(() => {
    if (!form) return [] as string[];
    return form.blocks
      .filter((b) => b.blockType === "FIELD" && b.options && b.options.allowDuplicate === false && b.label)
      .map((b) => b.label as string);
  }, [form]);

  // 중복 리드 id 집합: 위 기준 항목의 값이 (현재 목록 내에서) 겹치는 리드들
  const dupIds = useMemo(() => {
    const ids = new Set<number>();
    for (const label of uniqueFieldLabels) {
      const byVal = new Map<string, number[]>();
      for (const l of leads) {
        const v = (l.answers.find((a) => a.label === label)?.value || "").trim().toLowerCase();
        if (!v) continue;
        const arr = byVal.get(v) ?? [];
        arr.push(l.id);
        byVal.set(v, arr);
      }
      for (const arr of byVal.values()) {
        if (arr.length > 1) arr.forEach((id) => ids.add(id));
      }
    }
    return ids;
  }, [leads, uniqueFieldLabels]);

  // 현재 목록에 존재하는 태그 모음(필터 드롭다운용)
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) (l.tags ?? []).forEach((t) => set.add(t));
    return Array.from(set).sort();
  }, [leads]);

  // 상태·검색·중복·태그·날짜는 클라이언트 필터(즉시 반응)
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return leads.filter(
      (l) =>
        (!statusFilter || l.status === statusFilter) &&
        (!dupOnly || dupIds.has(l.id)) &&
        (!advUnseenOnly || !l.advertiserSeenAt) &&
        (!tagFilter || (l.tags ?? []).includes(tagFilter)) &&
        (!dateFrom || kstDate(l.createdAt) >= dateFrom) &&
        (!dateTo || kstDate(l.createdAt) <= dateTo) &&
        (!needle ||
          l.answers.some(
            (a) =>
              (a.value || "").toLowerCase().includes(needle) ||
              (a.label || "").toLowerCase().includes(needle),
          )),
    );
  }, [leads, q, statusFilter, dupOnly, advUnseenOnly, dupIds, tagFilter, dateFrom, dateTo]);

  const paging = usePaging(filtered, 25); // 컴팩트 행이라 한 화면에 더 많이(U3)

  function copyLink() {
    navigator.clipboard?.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  async function onStatus(leadId: number, status: string) {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l))); // 낙관적 반영
    try {
      await updateLeadStatus(leadId, status);
    } catch {
      load();
    }
  }

  async function onDelete(leadId: number) {
    if (!window.confirm("이 리드를 휴지통으로 옮길까요?")) return;
    setLeads((prev) => prev.filter((l) => l.id !== leadId)); // 낙관적 제거
    try {
      await deleteLead(leadId);
    } catch {
      load();
    }
  }

  async function onRestore(leadId: number) {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    try {
      await restoreLead(leadId);
    } catch {
      load();
    }
  }

  async function onPermanent(leadId: number) {
    if (!window.confirm("영구 삭제하면 되돌릴 수 없습니다. 삭제할까요?")) return;
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    try {
      await permanentDeleteLead(leadId);
    } catch {
      load();
    }
  }

  async function onImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;
    try {
      const r = await importLeads(formId, file);
      let msg = `${r.created}건 등록됨` + (r.failed ? ` · ${r.failed}건 실패` : "");
      if (r.errors.length) {
        msg += "\n\n" + r.errors.slice(0, 10).join("\n") + (r.errors.length > 10 ? `\n…외 ${r.errors.length - 10}건` : "");
      }
      window.alert(msg);
      load();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "가져오기에 실패했습니다.");
    }
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className={`wrap dashboard${detailId != null ? " with-drawer" : ""}`}>
        <div className="dash-head">
          <div>
            <p className="eyebrow">리드(수집 DB)</p>
            <h1 className="dash-title">{form ? form.name : "리드"}</h1>
            <p className="dash-sub">
              {trashed ? "휴지통" : "수집됨"} {filtered.length.toLocaleString()}건
              {!trashed && " · 줄을 클릭하면 상세(전체 답변·연락처·메모)가 열립니다"}
            </p>
          </div>
          <div className="edit-actions">
            <button className="btn btn-ghost" onClick={() => setTrashed((t) => !t)}>
              {trashed ? "← 리드 목록" : "🗑 휴지통"}
            </button>
            {!trashed && (
              <>
                <button className="btn btn-ghost" onClick={() => navigate(`/forms/${formId}/edit`)}>리드폼 편집</button>
                <button className="btn btn-ghost" onClick={() => navigate(`/forms/${formId}/ip-blocks`)}>IP 차단</button>
                <button className="btn btn-ghost" onClick={() => setShowEmbed((v) => !v)}>{showEmbed ? "임베드 닫기" : "임베드 코드"}</button>
                <button className="btn btn-ghost" onClick={copyLink}>{copied ? "복사됨!" : "공개 링크 복사"}</button>
                <button className="btn btn-ghost" onClick={openExport}>내보내기</button>
                <button className="btn btn-primary" onClick={() => window.open(publicUrl, "_blank")}>공개 리드폼 열기</button>
              </>
            )}
          </div>
        </div>

        {/* 외부 사이트 임베드 코드(M6) */}
        {showEmbed && !trashed && (
          <div className="card card-pad" style={{ marginBottom: 20 }}>
            <div className="card-h">외부 사이트 임베드 코드</div>
            <p className="dash-sub" style={{ marginTop: 0 }}>
              아래 코드를 외부 사이트/블로그의 HTML에 붙여넣으면 그 위치에 이 리드폼이 표시됩니다. (대상 사이트 디자인과 격리되어 렌더)
            </p>
            <textarea
              className="input"
              readOnly
              rows={2}
              style={{ fontFamily: "var(--mono)", fontSize: 13 }}
              value={embedSnippet}
              onFocus={(e) => e.currentTarget.select()}
            />
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={copyEmbed}>{embedCopied ? "복사됨!" : "코드 복사"}</button>
            </div>
          </div>
        )}

        {/* 내보내기 모달(형식 + 컬럼 선택) */}
        {exportOpen && (
          <div
            onClick={() => !exporting && setExportOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
          >
            <div
              className="card card-pad"
              onClick={(e) => e.stopPropagation()}
              style={{ width: "100%", maxWidth: 540, maxHeight: "85vh", display: "flex", flexDirection: "column" }}
            >
              <div className="card-h">리드 내보내기</div>

              <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "10px 0 14px" }}>
                <span className="dash-sub" style={{ fontSize: 13 }}>형식</span>
                <label style={{ display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
                  <input type="radio" name="exfmt" checked={exportFormat === "xlsx"} onChange={() => setExportFormat("xlsx")} /> 엑셀(.xlsx)
                </label>
                <label style={{ display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
                  <input type="radio" name="exfmt" checked={exportFormat === "csv"} onChange={() => setExportFormat("csv")} /> CSV
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="dash-sub" style={{ fontSize: 13 }}>내보낼 컬럼 ({exportSel.length}/{exportCols.length})</span>
                <span style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setExportSel(exportCols)}>전체선택</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setExportSel([])}>전체해제</button>
                </span>
              </div>
              <div style={{ overflowY: "auto", border: "1px solid rgba(128,128,128,0.3)", borderRadius: 8, padding: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px" }}>
                {exportCols.length === 0 ? (
                  <span className="dash-sub" style={{ fontSize: 13 }}>불러오는 중…</span>
                ) : (
                  exportCols.map((c) => (
                    <label key={c} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14, cursor: "pointer", minWidth: 0 }}>
                      <input type="checkbox" checked={exportSel.includes(c)} onChange={() => toggleExportCol(c)} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c}>{c}</span>
                    </label>
                  ))
                )}
              </div>
              <p className="dash-sub" style={{ fontSize: 12, margin: "8px 0 0" }}>
                현재 필터(날짜·검색·상태 등)가 적용된 <b>{filtered.length.toLocaleString()}건</b>을 내보냅니다.
                모든 셀이 텍스트 서식으로 저장되어 접수일시·연락처·긴 숫자가 깨지지 않습니다.
              </p>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                <button className="btn btn-ghost" onClick={() => setExportOpen(false)} disabled={exporting}>취소</button>
                <button className="btn btn-primary" onClick={runExport} disabled={exporting || exportSel.length === 0 || filtered.length === 0}>
                  {exporting ? "내보내는 중…" : "다운로드"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 검색·필터 */}
        <div className="card card-pad" style={{ marginBottom: 20, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            className="input"
            style={{ maxWidth: 280 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="검색 (이름·연락처 등 답변 내용)"
          />
          <select className="input" style={{ width: 140 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">상태 전체</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {/* 좁은 화면에서 두 날짜 입력이 줄바꿈되지 않아 문서 폭을 넘겼다 → wrap + 축소 허용 */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }} title="접수일시(KST) 범위로 검색">
            <input className="input" type="date" style={{ width: 150, maxWidth: "100%" }} value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} aria-label="접수 시작일" />
            <span className="dash-sub" style={{ fontSize: 12 }}>~</span>
            <input className="input" type="date" style={{ width: 150, maxWidth: "100%" }} value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} aria-label="접수 종료일" />
          </div>
          {allTags.length > 0 && (
            <select className="input" style={{ width: 140 }} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
              <option value="">태그 전체</option>
              {allTags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
          {!trashed && uniqueFieldLabels.length > 0 && (
            <button
              className={`btn btn-sm ${dupOnly ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setDupOnly((v) => !v)}
              title={`중복 판정 항목: ${uniqueFieldLabels.join(", ")}`}
            >
              중복만 보기{dupIds.size ? ` (${dupIds.size})` : ""}
            </button>
          )}
          {!trashed && leads.some((l) => l.advertiserSeenAt) && (
            <button
              className={`btn btn-sm ${advUnseenOnly ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setAdvUnseenOnly((v) => !v)}
              title="광고주가 아직 열어보지 않은 리드만 표시"
            >
              광고주 미확인만
            </button>
          )}
          {(q || statusFilter || dupOnly || advUnseenOnly || tagFilter || dateFrom || dateTo) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setQ(""); setStatusFilter(""); setDupOnly(false); setAdvUnseenOnly(false); setTagFilter(""); setDateFrom(""); setDateTo(""); }}>필터 초기화</button>
          )}
          {!trashed && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="dash-sub" style={{ fontSize: 12 }}>일괄 등록</span>
              <button className="btn btn-ghost btn-sm" onClick={() => downloadLeadTemplate(formId, "xlsx", form?.name || "lead")}>양식(엑셀)</button>
              <button className="btn btn-ghost btn-sm" onClick={() => downloadLeadTemplate(formId, "csv", form?.name || "lead")}>양식(CSV)</button>
              <button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()}>파일 가져오기</button>
              <input ref={fileRef} type="file" accept=".xlsx,.csv" hidden onChange={onImportFile} />
            </div>
          )}
        </div>

        {loading ? (
          <p className="dash-sub">불러오는 중…</p>
        ) : filtered.length === 0 ? (
          <div className="card card-pad empty-state">
            <p>
              {trashed
                ? "휴지통이 비어 있습니다."
                : leads.length === 0
                  ? "아직 수집된 리드가 없습니다."
                  : "조건에 맞는 리드가 없습니다."}
            </p>
            {!trashed && leads.length === 0 && (
              <button className="btn btn-primary" onClick={() => window.open(publicUrl, "_blank")}>공개 리드폼 열어서 테스트 제출</button>
            )}
          </div>
        ) : (
          <>
          {/* 한 리드 = 한 줄(U3). 전체 답변·방문자정보는 줄을 클릭해 여는 상세 패널에서 본다. */}
          <div className={`flead-rows${trashed ? " trash" : ""}`} role="list">
            <div className="flead-head" aria-hidden="true">
              <span>이름</span>
              <span>연락처</span>
              <span>답변 요약</span>
              <span>상태</span>
              <span>접수일시</span>
              <span />
            </div>
            {paging.pageItems.map((l) => {
              const name = pickName(l.answers);
              const phone = pickPhone(l.answers);
              const summary = summarizeAnswers(l.answers, [name, phone]);
              return (
                <div
                  role="listitem"
                  key={l.id}
                  className={`flead-row${detailId === l.id ? " active" : ""}`}
                  onClick={() => setDetailId(l.id)}
                  title="클릭하면 상세(전체 답변·방문자정보·메모)가 열립니다"
                >
                  <span className="fl-name">
                    <span className="fl-name-text">{name}</span>
                    {!trashed && dupIds.has(l.id) && (
                      <span className="fl-flag dup" title={`중복 판정 항목: ${uniqueFieldLabels.join(", ")}`}>중복</span>
                    )}
                    {!trashed && l.advertiserSeenAt && (
                      <span
                        className="fl-flag seen"
                        title={`광고주가 ${new Date(l.advertiserSeenAt).toLocaleString("ko-KR")}에 열람${l.advertiserStatus ? ` · 광고주 상태: ${advertiserStatusLabel(l.advertiserStatus)}` : ""}`}
                      >
                        👁
                      </span>
                    )}
                  </span>
                  <span className="fl-phone">{phone ? maskPhone(phone) : "—"}</span>
                  <span className="fl-summary" title={summary}>
                    {summary || "—"}
                    {(l.tags?.length ?? 0) > 0 && (
                      <span className="fl-tags">
                        {l.tags!.map((t) => (
                          <button
                            key={t}
                            className="fl-tag"
                            title="이 태그로 필터"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTagFilter(t);
                            }}
                          >
                            #{t}
                          </button>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="fl-status" onClick={(e) => e.stopPropagation()}>
                    {trashed ? (
                      <span className={`pill ld-pill ld-${l.status}`}>{leadStatusLabel(l.status)}</span>
                    ) : (
                      <select
                        className={`lead-status-select ld-${l.status}`}
                        value={l.status}
                        onChange={(e) => onStatus(l.id, e.target.value)}
                        aria-label="리드 상태"
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    )}
                  </span>
                  <span className="fl-time">
                    {new Date(l.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <span className="fl-actions" onClick={(e) => e.stopPropagation()}>
                    {trashed ? (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => onRestore(l.id)}>복원</button>
                        <button className="btn btn-ghost btn-sm danger" onClick={() => onPermanent(l.id)}>영구삭제</button>
                      </>
                    ) : (
                      <button className="btn btn-ghost btn-sm danger" onClick={() => onDelete(l.id)}>삭제</button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <Pagination total={paging.total} page={paging.page} pages={paging.pages} pageSize={paging.pageSize} onPage={paging.setPage} onPageSize={paging.setPageSize} unit="건" />
          </>
        )}
      </main>
      {detailId != null && (
        <LeadSidePanel
          leadId={detailId}
          formName={form?.name || "리드"}
          variant="drawer"
          onClose={() => setDetailId(null)}
          onChanged={(updated) => setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))}
        />
      )}
    </div>
  );
}
