import { useEffect, useMemo, useRef, useState } from "react";
import { Loading } from "../components/Loading";
import { useNavigate, useSearchParams } from "react-router-dom";
import { deleteForm, duplicateForm, listFolders, listForms, moveFormFolder, type FolderItem, type FormSummary } from "../api/client";
import { TopBar } from "../components/TopBar";
import { toast } from "../lib/toast";
import { Pagination, usePaging } from "../components/Pagination";
import { runBulk, useSelection } from "../lib/useSelection";
import { FolderTree, type FolderSelection } from "../components/FolderTree";
import { RevenueCell, RevenueHeader, useRevenueByEntity } from "../components/RevenuePeriod";
import { RowMenu } from "../components/RowMenu";
import { fmtShortDateTime } from "../lib/format";
import { ListFilterBar } from "../components/ListFilterBar";
import { matchesQuery, matchesTags, parseSort, sortList, type ListSort } from "../lib/listFilter";
import { TagChips } from "../components/TagPicker";
import { useTagFilterParams, useTagPool } from "../lib/useListTags";

const FORM_SORTS: ListSort[] = ["updated", "created", "name", "revenue", "oldest"];

export function FormsListPage() {
  const navigate = useNavigate();
  const [forms, setForms] = useState<FormSummary[]>([]);
  const revenue = useRevenueByEntity();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<FolderSelection>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  // 체크박스·버튼을 누른 채 살짝 움직이면 tr의 draggable이 하이재킹해 체크가 안 먹는 문제 방지용
  // (드래그는 tr 전체에 걸려 있어, 브라우저가 mousedown 지점에서 가장 가까운 draggable 조상을 찾다가
  // input/button까지 끌고 가버린다 — 실제 mousedown 대상을 기록해뒀다가 dragstart에서 걸러낸다).
  const dragOriginRef = useRef<EventTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 검색·필터·정렬은 주소(?q=&type=&cat=&sort=)에 둔다 — 편집하고 뒤로 와도 조건이 그대로 남는다.
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const typeFilter = params.get("type") ?? "";
  const catFilter = params.get("cat") ?? "";
  const sort = parseSort(params.get("sort"));
  const tagFilter = useTagFilterParams(params, setParams);
  const tagPool = useTagPool();
  function setParam(key: string, value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }
  function resetFilters() {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        ["q", "type", "cat", "tag", "tagMode"].forEach((k) => next.delete(k));
        return next;
      },
      { replace: true },
    );
  }
  const categories = useMemo(
    () => [...new Set(forms.map((f) => f.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, "ko")),
    [forms],
  );

  const inFolder = useMemo(() => {
    if (selectedFolder === null) return forms;
    if (selectedFolder === "unfiled") return forms.filter((f) => f.folderId == null);
    return forms.filter((f) => f.folderId === selectedFolder);
  }, [forms, selectedFolder]);
  const filtered = useMemo(
    () =>
      sortList(
        inFolder.filter(
          (f) =>
            matchesQuery(query, [f.name, f.category]) &&
            matchesTags(f.tags, tagFilter.selected, tagFilter.mode) &&
            (!typeFilter || f.formType === typeFilter) &&
            (!catFilter || (catFilter === "-" ? !f.category : f.category === catFilter)),
        ),
        sort,
        { name: (f) => f.name, revenue: (f) => revenue.byForm.get(f.id)?.revenue ?? 0 },
      ),
    [inFolder, query, typeFilter, catFilter, tagFilter.selected, tagFilter.mode, sort, revenue.byForm],
  );
  const folderCounts = useMemo(() => {
    const c: Record<number, number> = {};
    for (const f of forms) if (f.folderId != null) c[f.folderId] = (c[f.folderId] ?? 0) + 1;
    return c;
  }, [forms]);
  const paging = usePaging(filtered, 10);
  // 조건이 바뀌면 1쪽으로(개수가 같아도 — 정렬만 바꾼 경우)
  const { setPage } = paging;
  useEffect(() => {
    setPage(1);
  }, [query, typeFilter, catFilter, tagFilter.selected, tagFilter.mode, sort, selectedFolder, setPage]);

  async function loadFolders() {
    try {
      setFolders(await listFolders("FORM"));
    } catch {
      /* 폴더 로드 실패는 무시 — 목록 자체는 계속 보여준다 */
    }
  }

  async function onDropOnFolder(folderId: number | null) {
    if (draggingId == null) return;
    const id = draggingId;
    setDraggingId(null);
    try {
      await moveFormFolder(id, folderId);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "폴더 이동에 실패했습니다.");
    }
  }

  // 전체선택 + 일괄 삭제 (2026-08-08 — 액션 있는 모든 목록 공통)
  const sel = useSelection(paging.pageItems.map((f) => f.id));
  const [bulkBusy, setBulkBusy] = useState(false);
  async function onBulkDelete() {
    if (sel.count === 0 || bulkBusy) return;
    if (!window.confirm(`선택한 리드폼 ${sel.count}개를 삭제할까요? 수집된 리드도 함께 사라질 수 있습니다.`)) return;
    setBulkBusy(true);
    const { ok, fail } = await runBulk([...sel.selected], deleteForm);
    setBulkBusy(false);
    if (fail > 0) toast.error(`${ok}개 삭제, ${fail}개 실패`);
    else toast.success(`${ok}개 리드폼을 삭제했습니다.`);
    sel.clear();
    load();
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      setForms(await listForms());
    } catch {
      setError("리드폼 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadFolders();
  }, []);

  async function onDuplicate(id: number, name: string) {
    try {
      const copy = await duplicateForm(id);
      toast.success(`'${name}' 리드폼을 복사했습니다 → '${copy.name}'`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "복사에 실패했습니다.");
    }
  }

  async function onDelete(id: number, name: string) {
    if (!window.confirm(`'${name}' 리드폼을 삭제할까요?`)) return;
    try {
      await deleteForm(id);
      toast.success(`'${name}' 리드폼을 삭제했습니다.`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    }
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">리드폼 관리</p>
            <h1 className="dash-title">내 리드폼</h1>
            <p className="dash-sub">랜딩과 별개로 리드폼을 만들어 여러 곳에서 재사용합니다.</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate(typeof selectedFolder === "number" ? `/forms/new?folder=${selectedFolder}` : "/forms/new")}>
            + 새 리드폼 만들기
          </button>
        </div>

        {loading ? (
          <Loading />
        ) : error ? (
          <p className="auth-error">{error}</p>
        ) : forms.length === 0 ? (
          <div className="card card-pad empty-state">
            <p>아직 만든 리드폼이 없습니다.</p>
            <button className="btn btn-primary" onClick={() => navigate(typeof selectedFolder === "number" ? `/forms/new?folder=${selectedFolder}` : "/forms/new")}>
              첫 리드폼 만들기
            </button>
          </div>
        ) : (
          <div className="folders-layout">
            <FolderTree
              kind="FORM"
              folders={folders}
              selected={selectedFolder}
              onSelect={setSelectedFolder}
              onReload={loadFolders}
              onDropItem={onDropOnFolder}
              counts={folderCounts}
            />
            <div>
              <ListFilterBar
                query={query}
                onQuery={(v) => setParam("q", v)}
                placeholder="리드폼 이름·분야 검색"
                selects={[
                  {
                    label: "유형",
                    value: typeFilter,
                    onChange: (v) => setParam("type", v),
                    options: [
                      { value: "", label: "전체 유형" },
                      { value: "BASIC", label: "기본형" },
                      { value: "STEP", label: "스텝형" },
                    ],
                  },
                  {
                    label: "분야",
                    value: catFilter,
                    onChange: (v) => setParam("cat", v),
                    options: [
                      { value: "", label: "전체 분야" },
                      ...categories.map((c) => ({ value: c, label: c })),
                      { value: "-", label: "분야 없음" },
                    ],
                  },
                ]}
                tagFilter={{ pool: tagPool.pool, selected: tagFilter.selected, mode: tagFilter.mode, onChange: tagFilter.set }}
                sort={sort}
                onSort={(v) => setParam("sort", v === "updated" ? "" : v)}
                sorts={FORM_SORTS}
                shown={filtered.length}
                total={inFolder.length}
                onReset={resetFilters}
              />
              {sel.count > 0 && (
                <div className="il-bulk" style={{ paddingBottom: 10 }}>
                  <span className="bulk-count">{sel.count}개 선택</span>
                  <button className="btn btn-ghost btn-sm danger" disabled={bulkBusy} onClick={onBulkDelete}>선택 삭제</button>
                  <button className="btn btn-ghost btn-sm" disabled={bulkBusy} onClick={sel.clear}>해제</button>
                </div>
              )}
              {filtered.length === 0 ? (
                <div className="card card-pad empty-state">
                  <p>
                    {inFolder.length > 0
                      ? "조건에 맞는 리드폼이 없습니다."
                      : "이 폴더에는 리드폼이 없습니다. 목록 행을 드래그해서 여기로 옮겨보세요."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="card card-table">
                    <table className="list-table">
                      <thead>
                        <tr>
                          <th className="sel-col">
                            <input type="checkbox" checked={sel.allSelected} onChange={sel.toggleAll} aria-label="전체 선택" />
                          </th>
                          <th>이름</th>
                          <th>분야</th>
                          <th>유형</th>
                          <th>항목 수</th>
                          <th className="num"><RevenueHeader period={revenue.period} onChange={revenue.setPeriod} /></th>
                          <th>수정일</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paging.pageItems.map((f) => (
                          <tr
                            key={f.id}
                            className={`row-click row-draggable ${draggingId === f.id ? "dragging" : ""}`}
                            draggable
                            onMouseDownCapture={(e) => { dragOriginRef.current = e.target; }}
                            onDragStart={(e) => {
                              const origin = dragOriginRef.current;
                              if (origin instanceof HTMLElement && origin.closest("input, button, a")) {
                                e.preventDefault();
                                return;
                              }
                              setDraggingId(f.id);
                            }}
                            onDragEnd={() => setDraggingId(null)}
                            onClick={() => navigate(`/forms/${f.id}/edit`)}
                          >
                            <td className="sel-col" onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={sel.selected.has(f.id)} onChange={() => sel.toggle(f.id)} aria-label="선택" />
                            </td>
                            <td className="list-title">
                              {f.name}
                              {(f.tags ?? []).length > 0 && (
                                <div className="list-tags">
                                  <TagChips tags={f.tags} />
                                </div>
                              )}
                            </td>
                            <td className="nowrap" data-label="분야">{f.category ? <span className="pill">{f.category}</span> : <span className="dash-sub">—</span>}</td>
                            <td className="nowrap" data-label="유형">
                              {/* 리디자인 §6: 기본형=인디고 soft · 스텝형=그린 soft */}
                              <span className={f.formType === "BASIC" ? "pill i" : "pill gr"}>
                                {f.formType === "BASIC" ? "기본형" : "스텝형"}
                              </span>
                            </td>
                            <td className="num nowrap" data-label="항목">{f.blockCount}</td>
                            <td className="num nowrap" data-label="수익"><RevenueCell row={revenue.byForm.get(f.id)} /></td>
                            <td className="num nowrap" data-label="수정" title={new Date(f.updatedAt).toLocaleString("ko-KR")}>{fmtShortDateTime(f.updatedAt)}</td>
                            <td className="list-actions-cell" onClick={(e) => e.stopPropagation()}>
                              <div className="list-actions">
                                <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/forms/${f.id}/leads`)}>
                                  리드
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/forms/${f.id}/edit`)}>
                                  편집
                                </button>
                                <RowMenu
                                  items={[
                                    { label: "복사", onClick: () => onDuplicate(f.id, f.name) },
                                    { label: "삭제", onClick: () => onDelete(f.id, f.name), danger: true },
                                  ]}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination total={paging.total} page={paging.page} pages={paging.pages} pageSize={paging.pageSize} onPage={paging.setPage} onPageSize={paging.setPageSize} unit="개" />
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
