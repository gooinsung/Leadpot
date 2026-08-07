import { useEffect, useState } from "react";
import {
  ApiError,
  chargeFormBilling,
  getFormBilling,
  updateFormBilling,
  type BillingView,
} from "../api/client";

/**
 * 리드폼 편집의 '광고주 정산' 카드(V31) — 마케터 전용.
 *
 * 계약 모델: 광고주가 선입금(충전)하고, 리드가 <b>유효</b>로 확정될 때마다 DB 단가를 차감한다.
 * AS 인정(무효)되면 환급. 잔액이 임계값 미만이면 결제 담당자에게 문자(마케터 지정 번호 →
 * 광고주 등록 번호 → 없으면 안 보냄). 일 목표 수량이 차면 마케터에게 문자.
 * 잔액이 소진돼도 수집은 계속된다(마이너스 허용, 후정산) — 2026-08-08 사용자 확정.
 */
export function AdvertiserBillingCard({ formId }: { formId: number }) {
  const [view, setView] = useState<BillingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  // 설정 입력값
  const [unitPrice, setUnitPrice] = useState("0");
  const [dailyGoal, setDailyGoal] = useState("0");
  const [totalGoal, setTotalGoal] = useState("0");
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState("0");
  const [alertPhone, setAlertPhone] = useState("");
  // 충전 입력값
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeMemo, setChargeMemo] = useState("");
  const [ledgerOpen, setLedgerOpen] = useState(false);

  useEffect(() => {
    getFormBilling(formId)
      .then(apply)
      .catch(() => setView(null))
      .finally(() => setLoading(false));
  }, [formId]);

  function apply(v: BillingView) {
    setView(v);
    setUnitPrice(String(v.unitPrice));
    setDailyGoal(String(v.dailyGoal));
    setTotalGoal(String(v.totalGoal));
    setAlertEnabled(v.balanceAlertEnabled);
    setAlertThreshold(String(v.balanceAlertThreshold));
    setAlertPhone(v.balanceAlertPhone ?? "");
  }

  const num = (s: string) => {
    const n = Number(s.replace(/,/g, "").trim());
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  };
  const won = (n: number) => n.toLocaleString("ko-KR");

  async function onSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      apply(
        await updateFormBilling(formId, {
          unitPrice: num(unitPrice),
          dailyGoal: num(dailyGoal),
          totalGoal: num(totalGoal),
          balanceAlertEnabled: alertEnabled,
          balanceAlertThreshold: num(alertThreshold),
          balanceAlertPhone: alertPhone.trim(),
        }),
      );
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function onCharge() {
    const amount = num(chargeAmount);
    if (amount <= 0 || saving) return;
    if (!window.confirm(`${won(amount)}원 충전을 기록할까요? (원장에 남습니다)`)) return;
    setSaving(true);
    setError("");
    try {
      apply(await chargeFormBilling(formId, amount, chargeMemo.trim()));
      setChargeAmount("");
      setChargeMemo("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "충전 기록에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <div className="card-h">광고주 정산 (이 리드폼)</div>

      {!view || !view.linked ? (
        <p className="dash-sub" style={{ margin: 0 }}>
          이 리드폼에는 아직 연결된 광고주가 없습니다. <b>광고주 관리</b>에서 광고주에게 이 리드폼
          권한을 주면 여기서 DB 단가·충전·목표 수량을 설정할 수 있습니다.
        </p>
      ) : (
        <>
          <p className="dash-sub" style={{ marginTop: 0 }}>
            <b>{view.advertiserName}</b> 광고주와의 선입금 계약. 리드가 <b>유효</b>로 확정되는 순간
            단가가 차감되고, AS 인정(무효) 시 환급됩니다. 잔액이 소진돼도 수집은 멈추지 않습니다(후정산).
          </p>

          {/* 요약 지표 */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "12px 0" }}>
            <div className="kpi card" style={{ minWidth: 140, padding: 12 }}>
              <div className="k-label">현재 잔액</div>
              <div className="k-val" style={{ color: view.balance < 0 ? "var(--danger, #e5484d)" : undefined }}>
                {won(view.balance)}원
              </div>
            </div>
            <div className="kpi card" style={{ minWidth: 140, padding: 12 }}>
              <div className="k-label">이번달 수익</div>
              <div className="k-val">{won(view.earnedThisMonth)}원</div>
            </div>
            <div className="kpi card" style={{ minWidth: 140, padding: 12 }}>
              <div className="k-label">오늘 접수 / 일 목표</div>
              <div className="k-val">
                {view.todayLeads}{view.dailyGoal > 0 ? ` / ${view.dailyGoal}` : ""}
              </div>
            </div>
            {/* 승인 대기 = 유효도 무효도 아닌 리드(2026-08-08 사용자 요청 구분) */}
            <div className="kpi card" style={{ minWidth: 140, padding: 12 }} title="아직 유효/무효 판정 전인 리드">
              <div className="k-label">승인 대기 중 / 총 목표</div>
              <div className="k-val">
                {view.pendingLeads}{view.totalGoal > 0 ? ` / ${view.totalGoal}` : ""}
              </div>
            </div>
            <div className="kpi card" style={{ minWidth: 140, padding: 12 }} title="유효 처리(과금 확정)된 리드">
              <div className="k-label">유효 확정 / 총 목표</div>
              <div className="k-val">
                {view.validLeads}{view.totalGoal > 0 ? ` / ${view.totalGoal}` : ""}
              </div>
            </div>
          </div>

          {/* 계약 설정 */}
          <div style={{ display: "grid", gap: 12, maxWidth: 620 }}>
            <label className="field">
              <span className="field-label">유효 DB 단가 (원)</span>
              <input className="input" inputMode="numeric" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="예: 50000 (0 = 정산 안 함)" />
            </label>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label className="field" style={{ flex: "1 1 160px" }}>
                <span className="field-label">일 목표 수량 (건)</span>
                <input className="input" inputMode="numeric" value={dailyGoal} onChange={(e) => setDailyGoal(e.target.value)} placeholder="예: 5 (0 = 없음)" />
                <span className="dash-sub" style={{ fontSize: 12, marginTop: 4 }}>
                  그날 접수가 목표에 닿으면 <b>나(마케터)에게 문자</b>가 옵니다(하루 1회).
                </span>
              </label>
              <label className="field" style={{ flex: "1 1 160px" }}>
                <span className="field-label">총 목표 수량 (건)</span>
                <input className="input" inputMode="numeric" value={totalGoal} onChange={(e) => setTotalGoal(e.target.value)} placeholder="예: 50 (0 = 없음)" />
              </label>
            </div>

            <label className="fr-check" style={{ marginTop: 2 }}>
              <input type="checkbox" checked={alertEnabled} onChange={(e) => setAlertEnabled(e.target.checked)} /> 잔액 부족 문자 알림 보내기
            </label>
            {alertEnabled && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <label className="field" style={{ flex: "1 1 160px" }}>
                  <span className="field-label">알림 기준 잔액 (원)</span>
                  <input className="input" inputMode="numeric" value={alertThreshold} onChange={(e) => setAlertThreshold(e.target.value)} placeholder="예: 100000 — 이 금액 미만이면 발송" />
                </label>
                <label className="field" style={{ flex: "1 1 200px" }}>
                  <span className="field-label">받을 번호 (결제 담당자)</span>
                  <input className="input" inputMode="tel" value={alertPhone} onChange={(e) => setAlertPhone(e.target.value)} placeholder={view.notifyPhoneMasked ? `비우면 광고주 등록 번호(${view.notifyPhoneMasked})` : "비우면 광고주 등록 번호 (현재 미등록)"} />
                  <span className="dash-sub" style={{ fontSize: 12, marginTop: 4 }}>
                    결제하는 분이 접수 알림 수신자와 다를 수 있어 직접 지정합니다. 비우면 광고주가
                    등록한 번호로, 그것도 없으면 <b>보내지 않습니다</b>.
                  </span>
                </label>
              </div>
            )}
            <div>
              <button className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>
                {saving ? "저장 중…" : saved ? "저장됨!" : "정산 설정 저장"}
              </button>
            </div>
          </div>

          {/* 충전 */}
          <div className="card-h" style={{ marginTop: 18 }}>충전 기록</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
            <input className="input" style={{ width: 160 }} inputMode="numeric" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} placeholder="금액 (원)" />
            <input className="input" style={{ flex: "1 1 200px" }} value={chargeMemo} onChange={(e) => setChargeMemo(e.target.value)} placeholder="메모 (예: 8월 선입금)" maxLength={200} />
            <button className="btn btn-primary btn-sm" onClick={onCharge} disabled={saving || num(chargeAmount) <= 0}>충전 기록</button>
          </div>
          <p className="dash-sub" style={{ fontSize: 12, marginTop: 6 }}>
            실제 입금 확인 후 기록하세요. 모든 충전·차감·환급은 아래 원장에 남습니다.
          </p>

          {/* 원장 */}
          {view.ledger.length > 0 && (
            <details open={ledgerOpen} onToggle={(e) => setLedgerOpen((e.target as HTMLDetailsElement).open)} style={{ marginTop: 10 }}>
              <summary className="dash-sub" style={{ cursor: "pointer" }}>정산 내역 (최근 {view.ledger.length}건)</summary>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.9, fontSize: 13 }}>
                {view.ledger.map((r) => (
                  <li key={r.id}>
                    {new Date(r.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                    {" · "}
                    {r.entryType === "CHARGE" ? "충전" : r.entryType === "DEBIT" ? "차감" : r.entryType === "REFUND" ? "환급" : "조정"}
                    {" "}
                    <b style={{ color: r.amount < 0 ? "var(--danger, #e5484d)" : "var(--green-ink, #1a7f37)" }}>
                      {r.amount > 0 ? "+" : ""}{won(r.amount)}원
                    </b>
                    {r.leadId ? ` · 리드 #${r.leadId}` : ""}
                    {r.memo ? ` · ${r.memo}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {error && <p style={{ margin: "12px 0 0", color: "var(--danger, #e5484d)" }}>{error}</p>}
    </div>
  );
}
