import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createAdvertiserProfile,
  deleteAdvertiserProfile,
  downloadQuotePdf,
  listAdvertiserProfiles,
  listQuotes,
  updateAdvertiserProfile,
  type AdvertiserProfile,
  type AdvertiserProfileInput,
  type AdvertiserSummary,
  type QuoteSummary,
} from "../api/client";
import { QUOTE_STATUS_BADGE, QUOTE_STATUS_LABEL, quotePdfFilename, won } from "../lib/quote";
import { toast } from "../lib/toast";
import { Loading } from "./Loading";
import { RowMenu } from "./RowMenu";

const EMPTY_INPUT: AdvertiserProfileInput = {
  companyName: "",
  ceoName: "",
  bizNo: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  memo: "",
  advertiserUserId: null,
};

const FIELDS: { key: Exclude<keyof AdvertiserProfileInput, "advertiserUserId" | "memo">; label: string; placeholder?: string }[] = [
  { key: "companyName", label: "회사명 *", placeholder: "법률사무소 OOO" },
  { key: "contactName", label: "담당자", placeholder: "김담당" },
  { key: "phone", label: "연락처", placeholder: "010-0000-0000" },
  { key: "email", label: "이메일" },
  { key: "ceoName", label: "대표자" },
  { key: "bizNo", label: "사업자번호", placeholder: "000-00-00000" },
  { key: "address", label: "주소" },
];

/**
 * 광고주 관리 > **광고주 정보 · 견적서**(2026-10-29).
 * 광고주 정보는 포털 로그인 계정과 별개로 저장한다 — 계정 없이도 등록할 수 있고 요금제 광고주 수에 잡히지 않는다.
 * 계정이 있으면 연결해 둔다(초대를 수락하면 서버가 자동으로 만들어 연결한다).
 */
export function AdvertiserProfilesSection({ accounts }: { accounts: AdvertiserSummary[] }) {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<AdvertiserProfile[] | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<AdvertiserProfile | "new" | null>(null);
  const [form, setForm] = useState<AdvertiserProfileInput>(EMPTY_INPUT);
  const [saving, setSaving] = useState(false);
  const [quotesOf, setQuotesOf] = useState<AdvertiserProfile | null>(null);
  const [quotes, setQuotes] = useState<QuoteSummary[] | null>(null);

  async function load() {
    try {
      setProfiles(await listAdvertiserProfiles());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "광고주 정보를 불러오지 못했습니다.");
      setProfiles([]);
    }
  }

  useEffect(() => {
    load();
    // 계정 목록이 바뀌면(초대 수락·삭제) 연결 상태도 다시 읽는다.
  }, [accounts.length]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return profiles ?? [];
    return (profiles ?? []).filter((p) =>
      `${p.companyName} ${p.contactName} ${p.phone} ${p.email} ${p.accountEmail ?? ""}`.toLowerCase().includes(term),
    );
  }, [profiles, q]);

  function openEdit(p: AdvertiserProfile | "new") {
    setEditing(p);
    setForm(
      p === "new"
        ? EMPTY_INPUT
        : {
            companyName: p.companyName,
            ceoName: p.ceoName,
            bizNo: p.bizNo,
            contactName: p.contactName,
            phone: p.phone,
            email: p.email,
            address: p.address,
            memo: p.memo,
            advertiserUserId: p.advertiserUserId,
          },
    );
  }

  async function onSave() {
    if (!editing || saving) return;
    if (!form.companyName.trim()) {
      toast.error("회사명을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      if (editing === "new") await createAdvertiserProfile(form);
      else await updateAdvertiserProfile(editing.id, form);
      toast.success("광고주 정보를 저장했습니다.");
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(p: AdvertiserProfile) {
    const msg =
      p.quoteCount > 0
        ? `'${p.companyName}' 광고주 정보를 삭제할까요? 견적서 ${p.quoteCount}건은 견적서 메뉴에 그대로 남습니다(연결만 끊깁니다).`
        : `'${p.companyName}' 광고주 정보를 삭제할까요?`;
    if (!window.confirm(msg)) return;
    try {
      await deleteAdvertiserProfile(p.id);
      toast.success("삭제했습니다.");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    }
  }

  async function openQuotes(p: AdvertiserProfile) {
    setQuotesOf(p);
    setQuotes(null);
    try {
      setQuotes(await listQuotes(p.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "견적서를 불러오지 못했습니다.");
      setQuotes([]);
    }
  }

  async function onPdf(x: QuoteSummary) {
    try {
      await downloadQuotePdf(x.id, quotePdfFilename(x.quoteNo, x.recipientName));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF를 만들지 못했습니다.");
    }
  }

  // 연결할 수 있는 계정 = 아직 다른 광고주 정보에 연결되지 않은 계정 + 지금 편집 중인 정보에 연결된 계정
  const linkedIds = new Set((profiles ?? []).map((p) => p.advertiserUserId).filter((v): v is number => v != null));
  const linkable = accounts.filter(
    (a) => !linkedIds.has(a.id) || (editing !== "new" && editing?.advertiserUserId === a.id),
  );

  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="card-h" style={{ margin: 0 }}>광고주 정보 · 견적서</div>
          <p className="dash-sub" style={{ margin: "4px 0 0" }}>
            견적서 받는 곳으로 쓸 광고주 정보입니다. 포털 계정이 없어도 등록할 수 있고, 광고주별 견적서를 여기서 바로 볼 수 있습니다.
          </p>
        </div>
        {(profiles?.length ?? 0) > 5 && (
          <input className="input" style={{ width: 220 }} placeholder="회사명·담당자 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        )}
        <button className="btn btn-ghost" onClick={() => openEdit("new")}>
          + 광고주 등록
        </button>
      </div>

      {profiles === null ? (
        <Loading />
      ) : profiles.length === 0 ? (
        <p className="dash-sub" style={{ marginBottom: 0 }}>
          아직 광고주 정보가 없습니다. [+ 광고주 등록]을 누르거나, 견적서를 만들 때 '이 정보를 광고주로 저장'을 체크하세요.
        </p>
      ) : (
        <table style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>회사</th>
              <th>연락처</th>
              <th>포털 계정</th>
              <th>견적서</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.companyName}</div>
                  {p.contactName && <div className="dash-sub" style={{ fontSize: 13 }}>{p.contactName}</div>}
                  {p.memo && <div className="dash-sub" style={{ fontSize: 12, marginTop: 2 }}>📝 {p.memo}</div>}
                </td>
                <td>
                  <div>{p.phone || "-"}</div>
                  {p.email && <div className="dash-sub" style={{ fontSize: 13 }}>{p.email}</div>}
                </td>
                <td>{p.accountEmail ? <span className="pill g">{p.accountEmail}</span> : <span className="dash-sub">없음</span>}</td>
                <td className="num">
                  {p.quoteCount > 0 ? (
                    <button className="btn btn-ghost btn-sm" onClick={() => openQuotes(p)}>
                      {p.quoteCount}건 · 최근 {p.lastQuoteDate}
                    </button>
                  ) : (
                    <span className="dash-sub">없음</span>
                  )}
                </td>
                <td className="row-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => navigate(`/quotes/new?advertiser=${p.id}`)}>
                    견적서 만들기
                  </button>
                  <RowMenu
                    items={[
                      { label: "정보 수정", onClick: () => openEdit(p) },
                      { label: "견적서 보기", onClick: () => openQuotes(p) },
                      { label: "삭제", onClick: () => onDelete(p), danger: true },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 광고주 정보 등록·수정 */}
      {editing && (
        <div className="lead-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="card lead-modal invite-modal" role="dialog" aria-modal="true">
            <div className="lead-modal-head">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>광고주 정보</p>
                <h2 style={{ margin: "4px 0 0" }}>{editing === "new" ? "광고주 등록" : editing.companyName}</h2>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                닫기
              </button>
            </div>
            <div className="lead-modal-body">
              <div className="quote-party-grid">
                {FIELDS.map((f) => (
                  <div className="field" key={f.key}>
                    <label>{f.label}</label>
                    <input
                      className="input"
                      value={form[f.key]}
                      placeholder={f.placeholder}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  </div>
                ))}
                <div className="field">
                  <label>포털 계정 연결</label>
                  <select
                    className="input"
                    value={form.advertiserUserId ?? ""}
                    onChange={(e) => setForm({ ...form, advertiserUserId: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">연결 안 함</option>
                    {linkable.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.email}
                        {a.company ? ` (${a.company})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>내부 메모 (견적서·광고주에게 보이지 않습니다)</label>
                <textarea className="input" rows={2} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
              </div>
              <div className="grant-foot">
                <span />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-ghost" onClick={() => setEditing(null)}>
                    취소
                  </button>
                  <button className="btn btn-primary" disabled={saving} onClick={onSave}>
                    {saving ? "저장 중…" : "저장"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 광고주별 견적서 */}
      {quotesOf && (
        <div className="lead-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setQuotesOf(null)}>
          <div className="card lead-modal invite-modal" role="dialog" aria-modal="true" style={{ maxWidth: 760 }}>
            <div className="lead-modal-head">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>견적서</p>
                <h2 style={{ margin: "4px 0 0" }}>{quotesOf.companyName}</h2>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setQuotesOf(null)}>
                닫기
              </button>
            </div>
            <div className="lead-modal-body">
              {quotes === null ? (
                <Loading />
              ) : quotes.length === 0 ? (
                <p className="dash-sub">아직 이 광고주에게 만든 견적서가 없습니다.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>번호</th>
                      <th>제목</th>
                      <th>견적일</th>
                      <th className="num">총액</th>
                      <th>상태</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((x) => (
                      <tr key={x.id}>
                        <td className="num">{x.quoteNo}</td>
                        <td style={{ fontWeight: 600 }}>{x.title}</td>
                        <td className="num">{x.issueDate}</td>
                        <td className="num">{won(x.grandTotal)}원</td>
                        <td>
                          <span className={`badge ${QUOTE_STATUS_BADGE[x.status]}`}>{QUOTE_STATUS_LABEL[x.status]}</span>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/quotes/${x.id}`)}>
                            열기
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => onPdf(x)}>
                            PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="grant-foot">
                <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/quotes?advertiser=${quotesOf.id}`)}>
                  견적서 메뉴에서 보기
                </button>
                <button className="btn btn-primary" onClick={() => navigate(`/quotes/new?advertiser=${quotesOf.id}`)}>
                  새 견적서 만들기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
