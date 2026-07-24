import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BASE_URL,
  downloadLeadsCsv,
  getForm,
  LEAD_STATUSES,
  listLeads,
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

  const publicUrl = `${window.location.origin}/f/${formId}`;

  useEffect(() => {
    Promise.all([getForm(formId), listLeads(formId)])
      .then(([f, l]) => {
        setForm(f);
        setLeads(l);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [formId]);

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
      // 실패 시 목록 재조회로 복구
      listLeads(formId).then(setLeads).catch(() => {});
    }
  }

  function statusClass(status: string) {
    if (status === "DONE") return "b-normal";
    if (status === "SPAM") return "b-bad";
    if (status === "IN_PROGRESS") return "b-wait";
    return "";
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">리드(수집 DB)</p>
            <h1 className="dash-title">{form ? form.name : "리드"}</h1>
            <p className="dash-sub">총 {leads.length}건 수집됨 · 백엔드 API <code>{BASE_URL}</code></p>
          </div>
          <div className="edit-actions">
            <button className="btn btn-ghost" onClick={() => navigate(`/forms/${formId}/edit`)}>폼 편집</button>
            <button className="btn btn-ghost" onClick={copyLink}>{copied ? "복사됨!" : "공개 링크 복사"}</button>
            {leads.length > 0 && (
              <button className="btn btn-ghost" onClick={() => downloadLeadsCsv(formId, form?.name || "leads")}>CSV 내보내기</button>
            )}
            <button className="btn btn-primary" onClick={() => window.open(publicUrl, "_blank")}>공개 폼 열기</button>
          </div>
        </div>

        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <div className="card-h">공개 링크</div>
          <code className="public-link">{publicUrl}</code>
          <p className="dash-sub" style={{ marginTop: 8 }}>이 링크를 공유하면 방문자가 폼을 제출할 수 있고, 제출 데이터가 아래에 쌓입니다.</p>
        </div>

        {loading ? (
          <p className="dash-sub">불러오는 중…</p>
        ) : leads.length === 0 ? (
          <div className="card card-pad empty-state">
            <p>아직 수집된 리드가 없습니다.</p>
            <button className="btn btn-primary" onClick={() => window.open(publicUrl, "_blank")}>공개 폼 열어서 테스트 제출</button>
          </div>
        ) : (
          <div className="leads">
            {leads.map((l) => (
              <div className="card card-pad lead-card" key={l.id}>
                <div className="lead-head">
                  <span className="lead-time">{new Date(l.createdAt).toLocaleString("ko-KR")}</span>
                  <select
                    className={`lead-status-select ${statusClass(l.status)}`}
                    value={l.status}
                    onChange={(e) => onStatus(l.id, e.target.value)}
                  >
                    {LEAD_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
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
