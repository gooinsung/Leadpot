import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  changeQuoteStatus,
  createQuote,
  deleteQuote,
  downloadQuotePdf,
  duplicateQuote,
  getBusinessProfile,
  getQuote,
  issueQuote,
  listAdvertiserProfiles,
  listQuotes,
  saveQuoteRecipientAsAdvertiser,
  updateQuote,
  type AdvertiserProfile,
  type BusinessProfile,
  type Quote,
  type QuoteInput,
  type QuoteItem,
  type QuoteParty,
  type QuoteStatus,
  type VatMode,
} from "../api/client";
import { Loading } from "../components/Loading";
import { QuotePreview } from "../components/QuotePreview";
import { SearchableSelect } from "../components/SearchableSelect";
import { TopBar } from "../components/TopBar";
import {
  EMPTY_PARTY,
  QUOTE_STATUS_BADGE,
  QUOTE_STATUS_LABEL,
  VAT_MODE_LABEL,
  addDaysIso,
  emptyItem,
  lineAmount,
  quotePdfFilename,
  quoteTotals,
  todayIso,
  won,
} from "../lib/quote";
import { toast } from "../lib/toast";
import { useUnsavedGuard } from "../lib/useUnsavedGuard";

type RecipientMode = "manual" | "existing";

const RECIPIENT_FIELDS: { key: keyof QuoteParty; label: string; placeholder?: string }[] = [
  { key: "companyName", label: "회사명 *", placeholder: "법률사무소 OOO" },
  { key: "contactName", label: "담당자", placeholder: "김담당" },
  { key: "phone", label: "연락처", placeholder: "010-0000-0000" },
  { key: "email", label: "이메일" },
  { key: "ceoName", label: "대표자" },
  { key: "bizNo", label: "사업자번호" },
];

function partyFromProfile(p: AdvertiserProfile): QuoteParty {
  return {
    companyName: p.companyName,
    ceoName: p.ceoName,
    bizNo: p.bizNo,
    contactName: p.contactName,
    phone: p.phone,
    email: p.email,
    address: p.address,
    bankAccount: "",
  };
}

function supplierFromBusiness(b: BusinessProfile | null): QuoteParty {
  if (!b) return EMPTY_PARTY;
  return { ...EMPTY_PARTY, ...b, contactName: "" };
}

/** 품목을 아직 하나도 안 채웠는가 — 기존 광고주를 고를 때 지난 견적 품목을 불러와도 되는지 판단한다. */
function itemsPristine(items: QuoteItem[]): boolean {
  return items.every((it) => !it.name.trim() && !it.description.trim() && !Number(it.unitPrice));
}

/**
 * 견적서 생성·수정. 받는 쪽은 **수동 입력**과 **기존 광고주 선택** 둘 중 하나(사용자 결정 2026-10-29 —
 * 광고주를 먼저 등록해야만 발급되는 구조가 아니어야 한다).
 * 작성중일 때만 고칠 수 있고, 발행하면 잠긴다(고치려면 복제).
 */
export function QuoteEditPage() {
  const { id } = useParams();
  const quoteId = id ? Number(id) : null;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetProfileId = Number(params.get("advertiser")) || null;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(!!quoteId);
  const [profiles, setProfiles] = useState<AdvertiserProfile[]>([]);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);

  const [mode, setMode] = useState<RecipientMode>(presetProfileId ? "existing" : "manual");
  const [profileId, setProfileId] = useState<number | null>(presetProfileId);
  const [saveAsAdvertiser, setSaveAsAdvertiser] = useState(false);
  const [recipient, setRecipient] = useState<QuoteParty>(EMPTY_PARTY);
  const [title, setTitle] = useState("");
  const [issueDate, setIssueDate] = useState(todayIso());
  const [validUntil, setValidUntil] = useState<string>(addDaysIso(todayIso(), 14));
  const [vatMode, setVatMode] = useState<VatMode>("EXCLUDED");
  const [items, setItems] = useState<QuoteItem[]>([emptyItem()]);
  const [notes, setNotes] = useState<string[]>([""]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useUnsavedGuard(dirty);
  const readOnly = !!quote && quote.status !== "DRAFT";

  useEffect(() => {
    listAdvertiserProfiles()
      .then((list) => {
        setProfiles(list);
        // 광고주 관리의 [견적서 만들기] 로 들어온 새 견적서 — 그 광고주 정보로 채운다.
        if (!quoteId && presetProfileId) {
          const p = list.find((x) => x.id === presetProfileId);
          if (p) pickProfile(p, true);
        }
      })
      .catch(() => {});
    getBusinessProfile().then(setBusiness).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!quoteId) return;
    setLoading(true);
    getQuote(quoteId)
      .then((q) => {
        loadIntoForm(q);
        setDirty(false);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "견적서를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [quoteId]);

  function loadIntoForm(q: Quote) {
    setQuote(q);
    setMode(q.advertiserProfileId ? "existing" : "manual");
    setProfileId(q.advertiserProfileId);
    setSaveAsAdvertiser(false);
    setRecipient(q.recipient);
    setTitle(q.title);
    setIssueDate(q.issueDate);
    setValidUntil(q.validUntil ?? "");
    setVatMode(q.vatMode);
    setItems(q.items.length ? q.items.map(({ amount: _amount, ...it }) => it) : [emptyItem()]);
    setNotes(q.notes.length ? q.notes : [""]);
  }

  function touch() {
    setDirty(true);
  }

  /**
   * 기존 광고주 선택 → 받는 쪽 칸을 그 정보로 채운다(이 견적서에서만 고칠 수 있다).
   * 새 견적서이고 품목이 비어 있으면 **그 광고주에게 보낸 가장 최근 견적서**의 제목·품목·안내 문구도 불러온다.
   */
  async function pickProfile(p: AdvertiserProfile, initial = false) {
    setProfileId(p.id);
    setRecipient(partyFromProfile(p));
    if (!initial) touch();
    if (quoteId || !itemsPristine(items)) return;
    try {
      const prev = await listQuotes(p.id);
      if (prev.length === 0) return;
      const last = await getQuote(prev[0].id);
      setTitle((t) => t || last.title);
      setVatMode(last.vatMode);
      setItems(last.items.length ? last.items.map(({ amount: _amount, ...it }) => it) : [emptyItem()]);
      setNotes(last.notes.length ? last.notes : [""]);
      toast.info(`지난 견적서(${last.quoteNo})의 품목·안내 문구를 불러왔습니다.`);
    } catch {
      // 불러오기 실패는 조용히 넘어간다 — 직접 입력하면 된다.
    }
  }

  function switchMode(next: RecipientMode) {
    if (next === mode) return;
    setMode(next);
    touch();
    if (next === "manual") {
      setProfileId(null);
    } else {
      setSaveAsAdvertiser(false);
    }
  }

  function patchItem(i: number, patch: Partial<QuoteItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
    touch();
  }

  function moveItem(i: number, dir: -1 | 1) {
    setItems((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    touch();
  }

  const totals = useMemo(() => quoteTotals(items, vatMode), [items, vatMode]);

  function buildInput(): QuoteInput | null {
    if (!title.trim()) {
      toast.error("제목을 입력해주세요.");
      return null;
    }
    if (!recipient.companyName.trim()) {
      toast.error("받는 곳 회사명을 입력해주세요.");
      return null;
    }
    if (mode === "existing" && !profileId) {
      toast.error("광고주를 선택해주세요.");
      return null;
    }
    if (validUntil && validUntil < issueDate) {
      toast.error("유효기간은 견적일 이후여야 합니다.");
      return null;
    }
    return {
      advertiserProfileId: mode === "existing" ? profileId : null,
      saveAsAdvertiser: mode === "manual" && saveAsAdvertiser,
      recipient,
      title: title.trim(),
      issueDate,
      validUntil: validUntil || null,
      vatMode,
      // 품목명·금액이 모두 빈 줄은 버린다(빈 칸 한 줄이 PDF 에 찍히지 않게).
      items: items
        .filter((it) => it.name.trim() || it.description.trim() || Number(it.unitPrice))
        .map((it) => ({ ...it, quantity: Number(it.quantity) || 0, unitPrice: Number(it.unitPrice) || 0 })),
      notes: notes.map((n) => n.trim()).filter(Boolean),
    };
  }

  /** 저장하고 최신 견적서를 돌려준다. 새 견적서면 주소를 그 견적서로 바꾼다. */
  async function save(silent = false): Promise<Quote | null> {
    const input = buildInput();
    if (!input) return null;
    setBusy(true);
    try {
      const saved = quoteId ? await updateQuote(quoteId, input) : await createQuote(input);
      loadIntoForm(saved);
      setDirty(false);
      if (input.saveAsAdvertiser) {
        listAdvertiserProfiles().then(setProfiles).catch(() => {});
      }
      if (!silent) toast.success(quoteId ? "저장했습니다." : `${saved.quoteNo} 견적서를 만들었습니다.`);
      if (!quoteId) navigate(`/quotes/${saved.id}`, { replace: true });
      return saved;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onIssue() {
    if (!window.confirm("발행하면 더 이상 고칠 수 없습니다(고치려면 복제). 발행할까요?")) return;
    const saved = dirty || !quoteId ? await save(true) : quote;
    if (!saved) return;
    setBusy(true);
    try {
      loadIntoForm(await issueQuote(saved.id));
      toast.success("발행했습니다. PDF를 내려받아 광고주에게 보내세요.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "발행에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function onPdf() {
    // 저장 안 된 수정이 있으면 먼저 저장한다 — PDF 는 서버에 저장된 내용으로 만들어진다.
    const saved = !readOnly && (dirty || !quoteId) ? await save(true) : quote;
    if (!saved) return;
    try {
      await downloadQuotePdf(saved.id, quotePdfFilename(saved.quoteNo, saved.recipient.companyName));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF를 만들지 못했습니다.");
    }
  }

  async function onDuplicate() {
    if (!quote) return;
    if (dirty && !window.confirm("저장하지 않은 수정 내용은 복제되지 않습니다. 계속할까요?")) return;
    try {
      const copy = await duplicateQuote(quote.id);
      setDirty(false);
      toast.success(`${copy.quoteNo} 로 복제했습니다.`);
      navigate(`/quotes/${copy.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "복제에 실패했습니다.");
    }
  }

  async function onSaveAdvertiser() {
    if (!quote) return;
    try {
      loadIntoForm(await saveQuoteRecipientAsAdvertiser(quote.id));
      listAdvertiserProfiles().then(setProfiles).catch(() => {});
      toast.success("광고주로 저장했습니다. 광고주 관리에서도 이 견적서가 보입니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
    }
  }

  async function onStatus(status: QuoteStatus) {
    if (!quote) return;
    try {
      loadIntoForm(await changeQuoteStatus(quote.id, status));
      toast.success(`상태를 '${QUOTE_STATUS_LABEL[status]}'(으)로 바꿨습니다.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "상태를 바꾸지 못했습니다.");
    }
  }

  async function onDelete() {
    if (!quote || !window.confirm(`${quote.quoteNo} 견적서를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try {
      await deleteQuote(quote.id);
      setDirty(false);
      toast.success("견적서를 삭제했습니다.");
      navigate("/quotes");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    }
  }

  if (loading) {
    return (
      <div className="app-shell">
        <TopBar />
        <main className="wrap dashboard">
          <Loading />
        </main>
      </div>
    );
  }

  // 작성중이면 지금 사업장 정보, 발행 후에는 견적서에 박힌 복사본을 보여준다.
  const supplier = readOnly && quote ? quote.supplier : supplierFromBusiness(business);
  const businessEmpty = !readOnly && !business?.companyName;
  const linkedProfile = profiles.find((p) => p.id === (quote?.advertiserProfileId ?? profileId));

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">
              <Link to="/quotes">견적서</Link>
              {quote && <> · {quote.quoteNo}</>}
            </p>
            <h1 className="dash-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {quote ? quote.title : "견적서 생성"}
              {quote && <span className={`badge ${QUOTE_STATUS_BADGE[quote.status]}`}>{QUOTE_STATUS_LABEL[quote.status]}</span>}
            </h1>
            {readOnly && <p className="dash-sub">발행된 견적서는 고칠 수 없습니다. 고치려면 [복제]로 새 견적서를 만드세요.</p>}
          </div>
        </div>

        <div className="edit-grid quote-grid">
          <div className="edit-panel">
            {/* 받는 쪽 */}
            <div className="card card-pad">
              <div className="card-h">받는 곳</div>
              {!readOnly && (
                <div className="seg quote-mode" role="tablist">
                  <button type="button" className={mode === "manual" ? "on" : ""} onClick={() => switchMode("manual")}>
                    수동 입력
                  </button>
                  <button type="button" className={mode === "existing" ? "on" : ""} onClick={() => switchMode("existing")}>
                    기존 광고주 선택
                  </button>
                </div>
              )}

              {!readOnly && mode === "existing" && (
                <div className="field">
                  <label>광고주</label>
                  {profiles.length === 0 ? (
                    <p className="dash-sub" style={{ margin: 0 }}>
                      저장된 광고주가 없습니다. <Link to="/advertisers">광고주 관리</Link>에서 등록하거나, 수동 입력 후 '광고주로 저장'을 체크하세요.
                    </p>
                  ) : (
                    <SearchableSelect
                      value={profileId}
                      options={profiles.map((p) => ({ value: p.id, label: p.contactName ? `${p.companyName} (${p.contactName})` : p.companyName }))}
                      onChange={(v) => {
                        const p = profiles.find((x) => x.id === v);
                        if (p) pickProfile(p);
                        else {
                          setProfileId(null);
                          touch();
                        }
                      }}
                      placeholder="회사명 검색…"
                    />
                  )}
                </div>
              )}

              {(mode === "manual" || profileId || readOnly) && (
                <>
                  {!readOnly && mode === "existing" && (
                    <p className="dash-sub" style={{ marginTop: 0 }}>아래 값은 이 견적서에서만 바뀝니다. 광고주 정보 원본은 그대로입니다.</p>
                  )}
                  <div className="quote-party-grid">
                    {RECIPIENT_FIELDS.map((f) => (
                      <div className="field" key={f.key}>
                        <label>{f.label}</label>
                        <input
                          className="input"
                          value={recipient[f.key]}
                          placeholder={f.placeholder}
                          disabled={readOnly}
                          onChange={(e) => {
                            setRecipient({ ...recipient, [f.key]: e.target.value });
                            touch();
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!readOnly && mode === "manual" && !quote?.advertiserProfileId && (
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={saveAsAdvertiser}
                    onChange={(e) => {
                      setSaveAsAdvertiser(e.target.checked);
                      touch();
                    }}
                  />
                  이 정보를 광고주로 저장 <span className="dash-sub">— 다음 견적 때 '기존 광고주 선택'으로 불러오고, 광고주 관리에서도 이 견적서가 보입니다</span>
                </label>
              )}
              {quote && !quote.advertiserProfileId && !saveAsAdvertiser && (
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={onSaveAdvertiser} disabled={dirty}>
                    광고주로 저장
                  </button>
                  {dirty && <span className="dash-sub"> 먼저 저장해주세요</span>}
                </div>
              )}
              {linkedProfile && (quote?.advertiserProfileId ?? null) !== null && (
                <p className="dash-sub" style={{ marginBottom: 0 }}>
                  광고주 <Link to="/advertisers">{linkedProfile.companyName}</Link>에 연결된 견적서입니다.
                </p>
              )}
            </div>

            {/* 기본 정보 */}
            <div className="card card-pad" style={{ marginTop: 16 }}>
              <div className="card-h">기본 정보</div>
              <div className="field">
                <label>제목(건명) *</label>
                <input
                  className="input"
                  value={title}
                  placeholder="예: 개인회생 DB 공급"
                  disabled={readOnly}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    touch();
                  }}
                />
              </div>
              <div className="quote-party-grid">
                <div className="field">
                  <label>견적일</label>
                  <input
                    className="input"
                    type="date"
                    value={issueDate}
                    disabled={readOnly}
                    onChange={(e) => {
                      setIssueDate(e.target.value || todayIso());
                      touch();
                    }}
                  />
                </div>
                <div className="field">
                  <label>유효기간(선택)</label>
                  <input
                    className="input"
                    type="date"
                    value={validUntil}
                    min={issueDate}
                    disabled={readOnly}
                    onChange={(e) => {
                      setValidUntil(e.target.value);
                      touch();
                    }}
                  />
                </div>
              </div>
              <div className="field">
                <label>부가세</label>
                <select
                  className="input"
                  value={vatMode}
                  disabled={readOnly}
                  onChange={(e) => {
                    setVatMode(e.target.value as VatMode);
                    touch();
                  }}
                >
                  {(Object.keys(VAT_MODE_LABEL) as VatMode[]).map((m) => (
                    <option key={m} value={m}>
                      {VAT_MODE_LABEL[m]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 품목 */}
            <div className="card card-pad" style={{ marginTop: 16 }}>
              <div className="card-h">품목</div>
              <div className="quote-items">
                {items.map((it, i) => (
                  <div className="quote-item" key={i}>
                    <label className="qi qi-name">
                      <span>품목</span>
                      <input className="input" placeholder="개인회생 DB" value={it.name} disabled={readOnly} onChange={(e) => patchItem(i, { name: e.target.value })} />
                    </label>
                    <label className="qi qi-desc">
                      <span>설명</span>
                      <input className="input" placeholder="메타, 유튜브" value={it.description} disabled={readOnly} onChange={(e) => patchItem(i, { description: e.target.value })} />
                    </label>
                    <label className="qi qi-qty">
                      <span>수량</span>
                      <input className="input num" type="number" min={0} inputMode="numeric" value={it.quantity} disabled={readOnly} onChange={(e) => patchItem(i, { quantity: Number(e.target.value) })} />
                    </label>
                    <label className="qi qi-price">
                      <span>단가(원)</span>
                      <input className="input num" type="number" inputMode="numeric" value={it.unitPrice} disabled={readOnly} onChange={(e) => patchItem(i, { unitPrice: Number(e.target.value) })} />
                    </label>
                    <div className="qi qi-amt">
                      <span>{vatMode === "INCLUDED" ? "금액(VAT 포함)" : "공급가액"}</span>
                      <b>{won(lineAmount(it))}원</b>
                    </div>
                    <label className="qi qi-note">
                      <span>비고</span>
                      <input className="input" value={it.note} disabled={readOnly} onChange={(e) => patchItem(i, { note: e.target.value })} />
                    </label>
                    {!readOnly && (
                      <div className="qi-ctrl">
                        <button className="btn btn-ghost btn-sm" onClick={() => moveItem(i, -1)} disabled={i === 0} aria-label="위로">↑</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} aria-label="아래로">↓</button>
                        <button
                          className="btn btn-ghost btn-sm danger"
                          aria-label="줄 삭제"
                          onClick={() => {
                            setItems((prev) => (prev.length === 1 ? [emptyItem()] : prev.filter((_, idx) => idx !== i)));
                            touch();
                          }}
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {!readOnly && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    setItems((prev) => [...prev, emptyItem()]);
                    touch();
                  }}
                >
                  + 줄 추가
                </button>
              )}
              <div className="quote-totals">
                <span>공급가액 <b>{won(totals.supply)}원</b></span>
                <span>부가세 <b>{won(totals.vat)}원</b></span>
                <span className="grand">총액 <b>{won(totals.grand)}원</b></span>
              </div>
            </div>

            {/* 안내 문구 */}
            <div className="card card-pad" style={{ marginTop: 16 }}>
              <div className="card-h">안내 문구(선택)</div>
              {notes.map((n, i) => (
                <div className="quote-note-row" key={i}>
                  <span className="dash-sub">{i + 1}.</span>
                  <input
                    className="input"
                    value={n}
                    placeholder="예: 상기 견적가는 요구사항 범위에 따라 변동될 수 있습니다."
                    disabled={readOnly}
                    onChange={(e) => {
                      setNotes((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)));
                      touch();
                    }}
                  />
                  {!readOnly && (
                    <button
                      className="btn btn-ghost btn-sm danger"
                      aria-label="문구 삭제"
                      onClick={() => {
                        setNotes((prev) => (prev.length === 1 ? [""] : prev.filter((_, idx) => idx !== i)));
                        touch();
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {!readOnly && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setNotes((prev) => [...prev, ""]);
                    touch();
                  }}
                >
                  + 문구 추가
                </button>
              )}
            </div>

            {/* 공급자 */}
            <div className="card card-pad" style={{ marginTop: 16 }}>
              <div className="card-h">공급자(내 사업장)</div>
              {businessEmpty ? (
                <p className="dash-sub" style={{ margin: 0 }}>
                  사업장 정보가 비어 있습니다. <Link to="/account">마이페이지</Link>에서 먼저 입력하면 공급자 칸에 자동으로 들어갑니다.
                </p>
              ) : (
                <p className="dash-sub" style={{ margin: 0 }}>
                  {supplier.companyName} · {supplier.ceoName} · {supplier.bizNo}
                  {!readOnly && (
                    <>
                      {" "}— <Link to="/account">마이페이지에서 수정</Link>
                    </>
                  )}
                </p>
              )}
            </div>

            <div className="quote-actions">
              {!readOnly && (
                <>
                  <button className="btn btn-primary" disabled={busy} onClick={() => save()}>
                    {busy ? "저장 중…" : quoteId ? "저장" : "견적서 만들기"}
                  </button>
                  <button className="btn" disabled={busy} onClick={onIssue}>
                    발행
                  </button>
                </>
              )}
              <button className="btn btn-ghost" disabled={busy} onClick={onPdf}>
                PDF 다운로드
              </button>
              {quote && (
                <button className="btn btn-ghost" disabled={busy} onClick={onDuplicate}>
                  복제
                </button>
              )}
              {readOnly && quote && (
                <select className="input quote-status-select" value={quote.status} onChange={(e) => onStatus(e.target.value as QuoteStatus)} aria-label="상태">
                  {(["ISSUED", "ACCEPTED", "REJECTED"] as QuoteStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {QUOTE_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              )}
              {quote && (
                <button className="btn btn-ghost danger" disabled={busy} onClick={onDelete} style={{ marginLeft: "auto" }}>
                  삭제
                </button>
              )}
            </div>
          </div>

          <div className="preview-panel">
            <div className="card-h">미리보기</div>
            <div className="quote-preview-frame">
              <QuotePreview
                quoteNo={quote?.quoteNo ?? "(저장 시 번호 발급)"}
                title={title}
                issueDate={issueDate}
                validUntil={validUntil || null}
                vatMode={vatMode}
                supplier={supplier}
                recipient={recipient}
                items={items.filter((it) => it.name.trim() || it.description.trim() || Number(it.unitPrice))}
                notes={notes}
              />
            </div>
            <p className="dash-sub" style={{ fontSize: 12, marginTop: 6 }}>
              * 화면용 미리보기입니다. 실제 PDF는 서버가 같은 배치로 만듭니다.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
