import type { QuoteItem, QuoteParty, VatMode } from "../api/client";
import { lineAmount, quoteTotals, toHangulAmount, won } from "../lib/quote";

/**
 * 견적서 미리보기 — 서버 PDF({@code QuotePdfRenderer})와 같은 배치로 그린다.
 * 화면용 근사치다(실제 파일은 서버가 만든다). 배치를 바꾸면 PDF 쪽도 함께 바꾼다.
 */
export function QuotePreview({
  quoteNo,
  title,
  issueDate,
  validUntil,
  vatMode,
  supplier,
  recipient,
  items,
  notes,
}: {
  quoteNo: string;
  title: string;
  issueDate: string;
  validUntil: string | null;
  vatMode: VatMode;
  supplier: QuoteParty;
  recipient: QuoteParty;
  items: QuoteItem[];
  notes: string[];
}) {
  const t = quoteTotals(items, vatMode);
  const included = vatMode === "INCLUDED";
  const kv: [string, string][] = [
    ["견적번호", quoteNo],
    ["건명", title],
    ["견적일", dot(issueDate)],
    ["유효기간", validUntil ? `${dot(validUntil)} 까지` : ""],
    ["담당자", recipient.contactName],
    ["연락처", recipient.phone],
    ["이메일", recipient.email],
  ];
  const sup: [string, string][] = [
    ["상호", supplier.companyName],
    ["대표자", supplier.ceoName],
    ["사업자번호", supplier.bizNo],
    ["주소", supplier.address],
    ["연락처", supplier.phone],
    ["이메일", supplier.email],
  ];
  const shownNotes = notes.map((n) => n.trim()).filter(Boolean);
  return (
    <div className="qp">
      <h2 className="qp-title">견 적 서</h2>
      <div className="qp-head">
        <div className="qp-head-l">
          <p className="qp-to">
            <b>{recipient.companyName || "(받는 곳)"}</b> 귀하
          </p>
          <table className="qp-kv">
            <tbody>
              {kv
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <tr key={k}>
                    <th>{k}</th>
                    <td>{v}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="qp-lead">아래와 같이 견적합니다.</p>
        </div>
        <table className="qp-sup">
          <tbody>
            {sup.map(([k, v], i) => (
              <tr key={k}>
                {i === 0 && (
                  <th className="qp-sv" rowSpan={sup.length}>
                    공<br />급<br />자
                  </th>
                )}
                <th>{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="qp-sum">
        <span className="qp-sum-k">합계금액</span>
        <span className="qp-sum-v">
          <b>일금 {toHangulAmount(t.grand)}원정</b> (₩{won(t.grand)})
        </span>
      </div>

      <table className="qp-items">
        <thead>
          <tr>
            <th>No</th>
            <th>품목</th>
            <th>설명</th>
            <th>수량</th>
            <th>단가</th>
            <th>{included ? "금액(VAT 포함)" : "공급가액"}</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td className="c">{i + 1}</td>
              <td>{it.name}</td>
              <td>{it.description}</td>
              <td className="n">{won(it.quantity)}</td>
              <td className="n">{won(it.unitPrice)}</td>
              <td className="n">{won(lineAmount(it))}</td>
              <td>{it.note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="qp-totals">
        <tbody>
          <tr>
            <th>공급가액</th>
            <td>{won(t.supply)}원</td>
          </tr>
          <tr>
            <th>{vatMode === "EXEMPT" ? "부가세 (면세)" : "부가세"}</th>
            <td>{won(t.vat)}원</td>
          </tr>
          <tr className="grand">
            <th>총액</th>
            <td>{won(t.grand)}원</td>
          </tr>
        </tbody>
      </table>

      {shownNotes.length > 0 && (
        <div className="qp-notes">
          <p>안내 사항</p>
          <ol>
            {shownNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ol>
        </div>
      )}
      {supplier.bankAccount && (
        <p className="qp-bank">
          입금 계좌: <b>{supplier.bankAccount}</b>
        </p>
      )}
    </div>
  );
}

function dot(iso: string): string {
  return iso ? `${iso.replaceAll("-", ". ")}.` : "";
}
