import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BASE_URL,
  deleteLead,
  downloadLeadsCsv,
  getForm,
  LEAD_STATUSES,
  listLeads,
  permanentDeleteLead,
  restoreLead,
  updateLeadStatus,
  type FormDetail,
  type Lead,
} from "../api/client";
import { TopBar } from "../components/TopBar";

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

  const publicUrl = `${window.location.origin}/f/${formId}`;

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

  // 상태·검색은 클라이언트 필터(즉시 반응)
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return leads.filter(
      (l) =>
        (!statusFilter || l.status === statusFilter) &&
        (!needle ||
          l.answers.some(
            (a) =>
              (a.value || "").toLowerCase().includes(needle) ||
              (a.label || "").toLowerCase().includes(needle),
          )),
    );
  }, [leads, q, statusFilter]);

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

  function statusClass(status: string) {
    if (status === "DONE") return "b-normal";
    if (status === "SPAM") return "b-bad";
    if (status === "IN_PROGRESS") return "b-wait";
    return "";
  }
  const statusLabel = (v: string) => LEAD_STATUSES.find((s) => s.value === v)?.label ?? v;

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">리드(수집 DB)</p>
            <h1 className="dash-title">{form ? form.name : "리드"}</h1>
            <p className="dash-sub">
              {trashed ? "휴지통" : "수집됨"} {filtered.length}건 · 백엔드 API <code>{BASE_URL}</code>
            </p>
          </div>
          <div className="edit-actions">
            <button className="btn btn-ghost" onClick={() => setTrashed((t) => !t)}>
              {trashed ? "← 리드 목록" : "🗑 휴지통"}
            </button>
            {!trashed && (
              <>
                <button className="btn btn-ghost" onClick={() => navigate(`/forms/${formId}/edit`)}>리드폼 편집</button>
                <button className="btn btn-ghost" onClick={copyLink}>{copied ? "복사됨!" : "공개 링크 복사"}</button>
                <button className="btn btn-ghost" onClick={() => downloadLeadsCsv(formId, form?.name || "leads")}>CSV 내보내기</button>
                <button className="btn btn-primary" onClick={() => window.open(publicUrl, "_blank")}>공개 리드폼 열기</button>
              </>
            )}
          </div>
        </div>

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
          {(q || statusFilter) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setQ(""); setStatusFilter(""); }}>필터 초기화</button>
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
          <div className="leads">
            {filtered.map((l) => (
              <div className="card card-pad lead-card" key={l.id}>
                <div className="lead-head">
                  <span className="lead-time">{new Date(l.createdAt).toLocaleString("ko-KR")}</span>
                  {trashed ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span className={`badge ${statusClass(l.status)}`}>{statusLabel(l.status)}</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => onRestore(l.id)}>복원</button>
                      <button className="btn btn-ghost btn-sm danger" onClick={() => onPermanent(l.id)}>영구삭제</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <select
                        className={`lead-status-select ${statusClass(l.status)}`}
                        value={l.status}
                        onChange={(e) => onStatus(l.id, e.target.value)}
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <button className="btn btn-ghost btn-sm danger" onClick={() => onDelete(l.id)}>삭제</button>
                    </div>
                  )}
                </div>
                <div className="lead-answers">
                  {l.answers.map((a, i) => (
                    <div className="lead-answer" key={i}>
                      <span className="lead-a-label">{a.label}</span>
                      <span className="lead-a-value">{a.value || "-"}</span>
                    </div>
                  ))}
                </div>
                <div className="lead-meta">
                  <span>🖥️ {l.device ?? "-"} · {l.os ?? "-"} · {l.browser ?? "-"}</span>
                  <span>🌐 {l.submitterIp ?? "-"}</span>
                  {l.referer && <span>↩️ {l.referer}</span>}
                  {l.utm && Object.keys(l.utm).length > 0 && (
                    <span>📢 {Object.entries(l.utm).map(([k, v]) => `${k}=${v}`).join(" · ")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
