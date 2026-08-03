import { useEffect, useState } from "react";
import { Loading } from "../components/Loading";
import { useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  addIpBlock,
  clearIpBlockHits,
  deleteIpBlock,
  getForm,
  listIpBlockHits,
  listIpBlocks,
  type FormDetail,
  type IpBlock,
  type IpBlockHit,
} from "../api/client";
import { TopBar } from "../components/TopBar";
import { Pagination, usePaging } from "../components/Pagination";

export function IpBlocksPage() {
  const { id } = useParams();
  const formId = Number(id);
  const navigate = useNavigate();
  const [form, setForm] = useState<FormDetail | null>(null);
  const [blocks, setBlocks] = useState<IpBlock[]>([]);
  const [hits, setHits] = useState<IpBlockHit[]>([]);
  const blocksPaging = usePaging(blocks, 10);
  const hitsPaging = usePaging(hits, 10);
  const [loading, setLoading] = useState(true);
  const [pattern, setPattern] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function loadBlocks() {
    return listIpBlocks(formId).then(setBlocks).catch(() => {});
  }
  function loadHits() {
    return listIpBlockHits(formId).then(setHits).catch(() => {});
  }

  useEffect(() => {
    getForm(formId).then(setForm).catch(() => {});
  }, [formId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadBlocks(), loadHits()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const p = pattern.trim();
    if (!p) {
      setError("차단할 IP 또는 대역을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      await addIpBlock(formId, { pattern: p, reason: reason.trim() || undefined });
      setPattern("");
      setReason("");
      await loadBlocks();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "차단 규칙을 추가하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(blockId: number, pat: string) {
    if (!window.confirm(`'${pat}' 차단을 해제할까요?`)) return;
    setBlocks((prev) => prev.filter((b) => b.id !== blockId)); // 낙관적 제거
    try {
      await deleteIpBlock(formId, blockId);
    } catch {
      loadBlocks();
    }
  }

  async function onClearHits() {
    if (hits.length === 0) return;
    if (!window.confirm("차단 접속 로그를 모두 비울까요? 되돌릴 수 없습니다.")) return;
    setHits([]);
    try {
      await clearIpBlockHits(formId);
    } catch {
      loadHits();
    }
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">IP 차단 · 스팸 방어</p>
            <h1 className="dash-title">{form ? form.name : "IP 차단"}</h1>
            <p className="dash-sub">
              차단한 IP·대역에서 온 공개 리드폼 제출을 거부합니다. 단일 IP(<code>1.2.3.4</code>) 또는 대역(<code>1.2.3.0/24</code>) 지정.
            </p>
          </div>
          <div className="edit-actions">
            <button className="btn btn-ghost" onClick={() => navigate(`/forms/${formId}/leads`)}>← 리드 목록</button>
            <button className="btn btn-ghost" onClick={() => navigate(`/forms/${formId}/edit`)}>리드폼 편집</button>
          </div>
        </div>

        {/* 차단 규칙 추가 */}
        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <form onSubmit={onAdd} style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <input
                className="input"
                style={{ width: 200 }}
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="IP 또는 대역 (예: 1.2.3.4)"
              />
            </div>
            <input
              className="input"
              style={{ flex: 1, minWidth: 200 }}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="차단 사유(선택) — 예: 반복 장난 제출"
            />
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "추가 중…" : "차단 추가"}
            </button>
          </form>
          {error && <p className="auth-error" style={{ marginTop: 8 }}>{error}</p>}
        </div>

        {loading ? (
          <Loading />
        ) : (
          <>
            {/* 차단 목록 */}
            <h2 className="dash-title" style={{ fontSize: 18, marginBottom: 8 }}>차단 목록 ({blocks.length})</h2>
            {blocks.length === 0 ? (
              <div className="card card-pad empty-state" style={{ marginBottom: 28 }}>
                <p>아직 차단한 IP가 없습니다.</p>
              </div>
            ) : (
              <div className="card card-table" style={{ marginBottom: 28 }}>
                <table>
                  <thead>
                    <tr>
                      <th>IP / 대역</th>
                      <th>사유</th>
                      <th>등록일</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocksPaging.pageItems.map((b) => (
                      <tr key={b.id}>
                        <td><code>{b.pattern}</code></td>
                        <td>{b.reason || <span className="dash-sub">—</span>}</td>
                        <td className="num">{new Date(b.createdAt).toLocaleString("ko-KR")}</td>
                        <td>
                          <button className="btn btn-ghost btn-sm danger" onClick={() => onDelete(b.id, b.pattern)}>
                            해제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: "0 14px 12px" }}>
                  <Pagination total={blocksPaging.total} page={blocksPaging.page} pages={blocksPaging.pages} pageSize={blocksPaging.pageSize} onPage={blocksPaging.setPage} onPageSize={blocksPaging.setPageSize} unit="개" />
                </div>
              </div>
            )}

            {/* 차단 접속 로그 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h2 className="dash-title" style={{ fontSize: 18 }}>차단 접속 로그 ({hits.length})</h2>
              {hits.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={onClearHits}>로그 비우기</button>
              )}
            </div>
            <p className="dash-sub" style={{ marginTop: 0, marginBottom: 12 }}>
              차단된 IP가 제출을 시도한 내역입니다. 리드로는 저장되지 않습니다. (최근 500건)
            </p>
            {hits.length === 0 ? (
              <div className="card card-pad empty-state">
                <p>차단된 제출 시도가 아직 없습니다.</p>
              </div>
            ) : (
              <div className="card card-table">
                <table>
                  <thead>
                    <tr>
                      <th>시도 시각</th>
                      <th>IP</th>
                      <th>걸린 규칙</th>
                      <th>브라우저(UA)</th>
                      <th>유입경로</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hitsPaging.pageItems.map((h) => (
                      <tr key={h.id}>
                        <td className="num">{new Date(h.createdAt).toLocaleString("ko-KR")}</td>
                        <td><code>{h.ip}</code></td>
                        <td><code>{h.matchedPattern || "—"}</code></td>
                        <td style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={h.userAgent || ""}>
                          {h.userAgent || <span className="dash-sub">—</span>}
                        </td>
                        <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={h.referer || ""}>
                          {h.referer || <span className="dash-sub">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: "0 14px 12px" }}>
                  <Pagination total={hitsPaging.total} page={hitsPaging.page} pages={hitsPaging.pages} pageSize={hitsPaging.pageSize} onPage={hitsPaging.setPage} onPageSize={hitsPaging.setPageSize} unit="건" />
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
