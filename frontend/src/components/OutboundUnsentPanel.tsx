import { useEffect, useState } from "react";
import { ApiError, getOutboundUnsent, sendOutboundUnsent } from "../api/client";
import { toast } from "../lib/toast";

/**
 * 외부 API 전달 — 연동을 켜기 <b>전에</b> 들어와 한 번도 전송되지 않은 DB를 지금 보낸다(사용자 지시 2026-11-06).
 * 기간(접수일)을 고르면 그 기간의 미전송 건수를 보여 주고, 확인창을 거쳐 일괄 전송한다.
 * 서버는 <b>저장된</b> 리드폼 설정으로 한 건씩 보낸다 — 화면에서 고친 설정은 먼저 저장해야 반영된다.
 * 이미 성공·실패한 리드는 대상이 아니다(각 리드 상세의 [재시도]로 다시 보낸다).
 */
export function OutboundUnsentPanel({ formId }: { formId: number }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    getOutboundUnsent(formId, from, to)
      .then((r) => alive && setCount(r.total))
      .catch((e) => {
        if (!alive) return;
        setCount(null);
        setError(e instanceof ApiError ? e.message : "미전송 건수를 불러오지 못했습니다.");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [formId, from, to]);

  async function send() {
    if (!count || sending) return;
    const range = from || to ? ` (${from || "처음"} ~ ${to || "오늘"})` : " (전체 기간)";
    if (
      !window.confirm(
        `미전송 DB ${count.toLocaleString()}건${range}을 지금 외부 URL 로 전송합니다.\n` +
          "외부 업체로 실제 고객 정보가 넘어가며 되돌릴 수 없습니다. 계속할까요?",
      )
    )
      return;
    setSending(true);
    setError("");
    try {
      const r = await sendOutboundUnsent(formId, from, to);
      toast.success(
        r.remaining > 0
          ? `${r.queued.toLocaleString()}건 전송을 시작했습니다. 남은 ${r.remaining.toLocaleString()}건은 다시 눌러 보내 주세요.`
          : `${r.queued.toLocaleString()}건 전송을 시작했습니다. 결과는 각 리드 상세에서 확인할 수 있습니다.`,
      );
      setCount(r.remaining);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "일괄 전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ borderTop: "1px solid var(--line, #e5e7eb)", paddingTop: 12, display: "grid", gap: 8 }}>
      <span className="field-label">미전송 DB 지금 전송</span>
      <span className="dash-sub" style={{ fontSize: 12 }}>
        연동을 켜기 전에 들어와 한 번도 전송되지 않은 DB를 지금 보냅니다. <b>저장된 설정</b> 기준으로 한 건씩
        전송하니, 설정을 바꿨다면 먼저 저장하세요.
      </span>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input className="input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="접수 시작일" style={{ maxWidth: 170 }} />
        <span>~</span>
        <input className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="접수 종료일" style={{ maxWidth: 170 }} />
        <span className="dash-sub" style={{ minWidth: 90 }}>
          {loading ? "확인 중…" : count != null ? `미전송 ${count.toLocaleString()}건` : ""}
        </span>
        <button className="btn btn-sm" disabled={loading || sending || !count} onClick={send}>
          {sending ? "전송 중…" : "지금 전송"}
        </button>
      </div>
      {error && <span className="dash-sub" style={{ color: "var(--bad, #dc2626)", fontSize: 12 }}>{error}</span>}
    </div>
  );
}
