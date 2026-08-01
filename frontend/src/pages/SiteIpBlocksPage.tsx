import { useEffect, useState } from "react";
import {
  addSiteIpBlock,
  ApiError,
  deleteSiteIpBlock,
  listSiteIpBlocks,
  type IpBlock,
} from "../api/client";
import { TopBar } from "../components/TopBar";
import { Loading } from "../components/Loading";
import { toast } from "../lib/toast";

/**
 * 계정 전역 접속 차단.
 * 여기에 등록한 IP/대역은 내 공개 화면(랜딩·리드폼)에 **접속 자체가 막힌다**.
 * 리드폼별 IP 차단(리드폼 > IP 차단)은 '제출'만 막는 별개 기능이다.
 */
export function SiteIpBlocksPage() {
  const [blocks, setBlocks] = useState<IpBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [pattern, setPattern] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    listSiteIpBlocks()
      .then(setBlocks)
      .catch((e) => setError(e instanceof ApiError ? e.message : "불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const p = pattern.trim();
    if (!p || saving) return;
    setSaving(true);
    setError("");
    try {
      await addSiteIpBlock({ pattern: p, reason: reason.trim() || undefined });
      setPattern("");
      setReason("");
      toast.success(`${p} 을(를) 차단했습니다.`);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "추가하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(b: IpBlock) {
    if (!window.confirm(`'${b.pattern}' 차단을 해제할까요?`)) return;
    try {
      await deleteSiteIpBlock(b.id);
      toast.success(`${b.pattern} 차단을 해제했습니다.`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "해제하지 못했습니다.");
    }
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">운영</p>
            <h1 className="dash-title">접속 차단</h1>
            <p className="dash-sub">
              등록한 IP·대역은 <strong>내 랜딩페이지와 공개 리드폼에 접속 자체가 차단</strong>됩니다.
              (차단된 방문자에게는 페이지가 없는 것처럼 보입니다)
            </p>
          </div>
        </div>

        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <form onSubmit={onAdd} className="edit-actions" style={{ alignItems: "flex-end" }}>
            <div className="field" style={{ marginBottom: 0, flex: "1 1 220px", minWidth: 0 }}>
              <label>IP 또는 대역(CIDR)</label>
              <input
                className="input"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="예: 1.2.3.4 또는 1.2.3.0/24"
                spellCheck={false}
              />
            </div>
            <div className="field" style={{ marginBottom: 0, flex: "1 1 260px", minWidth: 0 }}>
              <label>사유 (선택)</label>
              <input
                className="input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="예: 경쟁사 반복 접속"
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving || !pattern.trim()}>
              {saving ? "추가 중…" : "차단 추가"}
            </button>
          </form>
          {error && <p className="auth-error" style={{ marginTop: 12 }}>{error}</p>}
        </div>

        {loading ? (
          <Loading />
        ) : blocks.length === 0 ? (
          <div className="card card-pad empty-state">
            <p>차단한 IP가 없습니다.</p>
            <p className="dash-sub" style={{ marginTop: -6 }}>
              특정 IP의 접속을 막고 싶을 때 위에서 추가하세요.
            </p>
          </div>
        ) : (
          <div className="card card-table">
            <table>
              <thead>
                <tr>
                  <th>IP / 대역</th>
                  <th>사유</th>
                  <th>등록일</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {blocks.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontFamily: "var(--mono)" }}>{b.pattern}</td>
                    <td>{b.reason || <span className="dash-sub">—</span>}</td>
                    <td className="num">{new Date(b.createdAt).toLocaleString("ko-KR")}</td>
                    <td className="row-actions">
                      <button className="btn btn-ghost btn-sm danger" onClick={() => onDelete(b)}>
                        해제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="dash-sub" style={{ marginTop: 16 }}>
          ℹ️ 리드폼별로 <strong>제출만</strong> 막고 싶다면 리드폼 → IP 차단을 쓰세요. 여기 등록한 규칙은
          접속·제출을 모두 막습니다(외부 사이트에 임베드한 폼 포함).
        </p>
      </main>
    </div>
  );
}
