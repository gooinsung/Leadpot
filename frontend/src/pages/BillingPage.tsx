import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, getBillingOverview, type BillingOverviewRow } from "../api/client";
import { Loading } from "../components/Loading";
import { TopBar } from "../components/TopBar";

/**
 * 정산 총괄(마케터, 2026-08-08 사용자 요청) — 과금 계약이 걸린 리드폼 전부의
 * 잔액·이번달 수익·목표 진행을 한 화면으로. 상세 설정(단가·충전·잔액 알림)은
 * 각 리드폼 편집의 '광고주 정산' 카드에서 한다(여기서 행 클릭 → 이동).
 */
export function BillingPage() {
  const [rows, setRows] = useState<BillingOverviewRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getBillingOverview()
      .then(setRows)
      .catch((e) => {
        setRows([]);
        setError(e instanceof ApiError ? e.message : "불러오지 못했습니다.");
      });
  }, []);

  const won = (n: number) => n.toLocaleString("ko-KR");
  const totalBalance = (rows ?? []).reduce((s, r) => s + r.balance, 0);
  const totalEarned = (rows ?? []).reduce((s, r) => s + r.earnedThisMonth, 0);

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">정산</p>
            <h1 className="dash-title">이번달 수입 정산</h1>
            <p className="dash-sub">
              선입금 계약이 걸린 리드폼별 잔액·수익·목표 진행입니다. 단가·충전·알림 설정은 각
              리드폼 편집의 <b>광고주 정산</b> 카드에서 합니다.
            </p>
          </div>
        </div>

        {rows === null ? (
          <Loading />
        ) : rows.length === 0 ? (
          <div className="card card-pad empty-state">
            <p>{error || "아직 정산 계약이 걸린 리드폼이 없습니다."}</p>
            {!error && (
              <p className="dash-sub" style={{ marginTop: -6 }}>
                리드폼에 광고주를 연결하고, 리드폼 편집의 '광고주 정산' 카드에서 DB 단가를
                설정하면 여기에 나타납니다.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* 전체 합계 */}
            <div className="kpis" style={{ marginBottom: 20 }}>
              <div className="kpi card">
                <div className="k-label">이번달 총 수익</div>
                <div className="k-val">{won(totalEarned)}원</div>
              </div>
              <div className="kpi card">
                <div className="k-label">전체 잔액 합계</div>
                <div className="k-val" style={{ color: totalBalance < 0 ? "var(--danger, #e5484d)" : undefined }}>
                  {won(totalBalance)}원
                </div>
              </div>
              <div className="kpi card">
                <div className="k-label">계약 리드폼</div>
                <div className="k-val">{rows.length}</div>
              </div>
            </div>

            {/* 계약별 표 — 좁은 화면에서는 표가 스스로 스크롤된다 */}
            <div className="card" style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", minWidth: 760 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "10px 14px" }}>리드폼 / 광고주</th>
                    <th style={{ textAlign: "right", padding: "10px 14px" }}>단가</th>
                    <th style={{ textAlign: "right", padding: "10px 14px" }}>잔액</th>
                    <th style={{ textAlign: "right", padding: "10px 14px" }}>이번달 수익</th>
                    <th style={{ textAlign: "right", padding: "10px 14px" }}>오늘 / 일 목표</th>
                    <th style={{ textAlign: "right", padding: "10px 14px" }}>승인 대기 / 총 목표</th>
                    <th style={{ textAlign: "right", padding: "10px 14px" }}>유효 확정 / 총 목표</th>
                    <th style={{ padding: "10px 14px" }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.formId} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ fontWeight: 700 }}>{r.formName}</div>
                        <div className="dash-sub" style={{ fontSize: 12 }}>{r.advertiserName}</div>
                      </td>
                      <td style={{ textAlign: "right", padding: "10px 14px", fontVariantNumeric: "tabular-nums" }}>
                        {r.unitPrice > 0 ? `${won(r.unitPrice)}원` : <span className="dash-sub">미설정</span>}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          padding: "10px 14px",
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 700,
                          color: r.balance < 0 ? "var(--danger, #e5484d)" : undefined,
                        }}
                      >
                        {won(r.balance)}원
                      </td>
                      <td style={{ textAlign: "right", padding: "10px 14px", fontVariantNumeric: "tabular-nums" }}>
                        {won(r.earnedThisMonth)}원
                      </td>
                      <td style={{ textAlign: "right", padding: "10px 14px", fontVariantNumeric: "tabular-nums" }}>
                        {r.todayLeads}{r.dailyGoal > 0 ? ` / ${r.dailyGoal}` : ""}
                      </td>
                      <td style={{ textAlign: "right", padding: "10px 14px", fontVariantNumeric: "tabular-nums" }}>
                        {r.pendingLeads}{r.totalGoal > 0 ? ` / ${r.totalGoal}` : ""}
                      </td>
                      <td style={{ textAlign: "right", padding: "10px 14px", fontVariantNumeric: "tabular-nums" }}>
                        {r.validLeads}{r.totalGoal > 0 ? ` / ${r.totalGoal}` : ""}
                      </td>
                      <td style={{ textAlign: "right", padding: "10px 14px" }}>
                        <Link className="btn btn-ghost btn-sm" to={`/forms/${r.formId}/edit`}>
                          설정 →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="dash-sub" style={{ fontSize: 12, marginTop: 10 }}>
              승인 대기 = 아직 유효/무효 판정 전인 리드 · 유효 확정 = 과금이 확정된 리드.
              수익 = 이번달 차감 − 환급(충전은 예치금이라 수익이 아닙니다).
            </p>
          </>
        )}
      </main>
    </div>
  );
}
