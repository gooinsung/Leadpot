import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  deleteQuote,
  downloadQuotePdf,
  duplicateQuote,
  listAdvertiserProfiles,
  listQuotes,
  type AdvertiserProfile,
  type QuoteStatus,
  type QuoteSummary,
} from "../api/client";
import { Loading } from "../components/Loading";
import { Pagination, usePaging } from "../components/Pagination";
import { TopBar } from "../components/TopBar";
import { QUOTE_STATUS_BADGE, QUOTE_STATUS_LABEL, quotePdfFilename, won } from "../lib/quote";
import { toast } from "../lib/toast";

/** 견적서 목록 — 광고주·상태·검색으로 거르고, 여기서 바로 PDF·복제·삭제. */
export function QuotesListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const profileFilter = Number(params.get("advertiser")) || null;
  const [quotes, setQuotes] = useState<QuoteSummary[] | null>(null);
  const [profiles, setProfiles] = useState<AdvertiserProfile[]>([]);
  const [status, setStatus] = useState<QuoteStatus | "">("");
  const [q, setQ] = useState("");

  async function load() {
    try {
      setQuotes(await listQuotes(profileFilter));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "불러오지 못했습니다.");
      setQuotes([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileFilter]);

  useEffect(() => {
    listAdvertiserProfiles().then(setProfiles).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (quotes ?? []).filter(
      (x) =>
        (!status || x.status === status) &&
        (!term || `${x.quoteNo} ${x.title} ${x.recipientName}`.toLowerCase().includes(term)),
    );
  }, [quotes, status, q]);
  const paging = usePaging(filtered, 20);

  async function onPdf(x: QuoteSummary) {
    try {
      await downloadQuotePdf(x.id, quotePdfFilename(x.quoteNo, x.recipientName));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF를 만들지 못했습니다.");
    }
  }

  async function onDuplicate(x: QuoteSummary) {
    try {
      const copy = await duplicateQuote(x.id);
      toast.success(`${copy.quoteNo} 로 복제했습니다.`);
      navigate(`/quotes/${copy.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "복제에 실패했습니다.");
    }
  }

  async function onDelete(x: QuoteSummary) {
    if (!window.confirm(`${x.quoteNo} '${x.title}' 견적서를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try {
      await deleteQuote(x.id);
      toast.success("견적서를 삭제했습니다.");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    }
  }

  const newHref = profileFilter ? `/quotes/new?advertiser=${profileFilter}` : "/quotes/new";

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">견적서</p>
            <h1 className="dash-title">견적서</h1>
            <p className="dash-sub">광고주에게 보낼 견적서를 만들고 PDF로 내려받습니다. 지난 견적서를 복제하면 반복 발행이 빠릅니다.</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate(newHref)}>
            + 견적서 생성
          </button>
        </div>

        <div className="quote-filters">
          <select
            className="input"
            value={profileFilter ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setParams(v ? { advertiser: v } : {});
            }}
            aria-label="광고주"
          >
            <option value="">전체 광고주</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.companyName}
              </option>
            ))}
          </select>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as QuoteStatus | "")} aria-label="상태">
            <option value="">전체 상태</option>
            {(Object.keys(QUOTE_STATUS_LABEL) as QuoteStatus[]).map((s) => (
              <option key={s} value={s}>
                {QUOTE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <input className="input" placeholder="번호·제목·받는 곳 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {quotes === null ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <div className="card card-pad empty-state">
            <p>{quotes.length === 0 ? "아직 만든 견적서가 없습니다." : "조건에 맞는 견적서가 없습니다."}</p>
            {quotes.length === 0 && (
              <button className="btn btn-primary" onClick={() => navigate(newHref)}>
                첫 견적서 만들기
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="card card-table">
              <table>
                <thead>
                  <tr>
                    <th>번호</th>
                    <th>제목</th>
                    <th>받는 곳</th>
                    <th>견적일</th>
                    <th className="num">총액</th>
                    <th>상태</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paging.pageItems.map((x) => (
                    <tr key={x.id} className="row-click" onClick={() => navigate(`/quotes/${x.id}`)}>
                      <td className="num">{x.quoteNo}</td>
                      <td style={{ fontWeight: 600 }}>{x.title}</td>
                      <td>{x.recipientName}</td>
                      <td className="num">{x.issueDate}</td>
                      <td className="num">{won(x.grandTotal)}원</td>
                      <td>
                        <span className={`badge ${QUOTE_STATUS_BADGE[x.status]}`}>{QUOTE_STATUS_LABEL[x.status]}</span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: "nowrap" }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => onPdf(x)}>PDF</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => onDuplicate(x)}>복제</button>
                        <button className="btn btn-ghost btn-sm danger" onClick={() => onDelete(x)}>삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={paging.total} page={paging.page} pages={paging.pages} pageSize={paging.pageSize} onPage={paging.setPage} onPageSize={paging.setPageSize} />
          </>
        )}
      </main>
    </div>
  );
}
