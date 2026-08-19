import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ApiError,
  listAdminUserForms,
  listAdminUserLandings,
  listAdminUserLeads,
  listAdminUsers,
  type AdminUserRow,
  type FormSummary,
  type LandingSummary,
  type Lead,
} from "../api/client";
import { TopBar } from "../components/TopBar";
import { Loading } from "../components/Loading";

/**
 * 운영자 계정 상세 — 계정의 리드폼·랜딩·리드 **읽기 전용** 열람 (2026-08-19 정책 변경).
 *
 * 조회만 가능하다: 수정/삭제/상태변경 버튼을 만들지 않는다(서버에도 그런 API 가 없다).
 * 리드 탭 조회는 서버가 감사 이력(LEADS_VIEW)에 남긴다 — 화면에도 그 사실을 표시해
 * 운영자가 인지하고 열람하게 한다.
 */
type Tab = "forms" | "landings" | "leads";

const STATUS_LABEL: Record<string, string> = {
  NEW: "신규",
  VALID: "유효",
  INVALID: "무효",
  AS_REQUESTED: "AS요청",
  CUSTOM: "커스텀",
};

export function AdminUserDetailPage() {
  const { id = "" } = useParams();
  const userId = Number(id);

  const [account, setAccount] = useState<AdminUserRow | null>(null);
  const [tab, setTab] = useState<Tab>("forms");
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [landings, setLandings] = useState<LandingSummary[]>([]);
  const [leads, setLeads] = useState<Lead[] | null>(null); // null = 아직 열람 안 함
  const [formFilter, setFormFilter] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [error, setError] = useState("");

  // 계정 정보 + 폼/랜딩은 개인정보가 아니라 바로 불러온다.
  // 리드는 감사 이력이 남는 열람이라 탭을 눌렀을 때만 불러온다(아래 useEffect).
  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([listAdminUsers(), listAdminUserForms(userId), listAdminUserLandings(userId)])
      .then(([users, f, l]) => {
        if (!alive) return;
        setAccount(users.find((u) => u.id === userId) ?? null);
        setForms(f);
        setLandings(l);
      })
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : "불러오지 못했습니다."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (tab !== "leads") return;
    let alive = true;
    setLeadsLoading(true);
    listAdminUserLeads(userId, formFilter === "" ? undefined : formFilter)
      .then((rows) => alive && setLeads(rows))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : "리드를 불러오지 못했습니다."))
      .finally(() => alive && setLeadsLoading(false));
    return () => {
      alive = false;
    };
  }, [tab, userId, formFilter]);

  const formNames = useMemo(() => {
    const map = new Map<number, string>();
    forms.forEach((f) => map.set(f.id, f.name));
    return map;
  }, [forms]);

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">운영자 · 계정 상세</p>
            <h1 className="dash-title">{account ? account.email : `계정 #${id}`}</h1>
            <p className="dash-sub">
              {account && (
                <>
                  {account.name}
                  {account.subdomain ? ` · ${account.subdomain}` : ""}
                  {!account.active ? " · 정지됨" : ""}
                  {" — "}
                </>
              )}
              <strong>조회 전용</strong>입니다. 리드 열람은 감사 이력에 남습니다.
            </p>
          </div>
          <Link className="btn btn-ghost" to="/admin">
            ← 계정 목록
          </Link>
        </div>

        <div className="edit-actions" style={{ marginBottom: 16, gap: 8 }}>
          <button className={tab === "forms" ? "btn btn-primary" : "btn btn-ghost"} onClick={() => setTab("forms")}>
            리드폼 {forms.length}
          </button>
          <button
            className={tab === "landings" ? "btn btn-primary" : "btn btn-ghost"}
            onClick={() => setTab("landings")}
          >
            랜딩 {landings.length}
          </button>
          <button className={tab === "leads" ? "btn btn-primary" : "btn btn-ghost"} onClick={() => setTab("leads")}>
            리드{account ? ` ${account.leadCount}` : ""}
          </button>
        </div>

        {loading ? (
          <Loading />
        ) : error ? (
          <div className="card card-pad empty-state">
            <p>{error}</p>
          </div>
        ) : tab === "forms" ? (
          forms.length === 0 ? (
            <div className="card card-pad empty-state">
              <p>리드폼이 없습니다.</p>
            </div>
          ) : (
            <div className="card card-table">
              <table>
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>분야</th>
                    <th>유형</th>
                    <th>블록</th>
                    <th>수정일</th>
                  </tr>
                </thead>
                <tbody>
                  {forms.map((f) => (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 600 }}>{f.name}</td>
                      <td>{f.category ?? "-"}</td>
                      <td>{f.formType === "STEP" ? "스텝형" : "기본형"}</td>
                      <td>{f.blockCount}</td>
                      <td>{new Date(f.updatedAt).toLocaleString("ko-KR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === "landings" ? (
          landings.length === 0 ? (
            <div className="card card-pad empty-state">
              <p>랜딩이 없습니다.</p>
            </div>
          ) : (
            <div className="card card-table">
              <table>
                <thead>
                  <tr>
                    <th>제목</th>
                    <th>주소(slug)</th>
                    <th>상태</th>
                    <th>수정일</th>
                  </tr>
                </thead>
                <tbody>
                  {landings.map((l) => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 600 }}>{l.title}</td>
                      <td>{l.slug}</td>
                      <td>{l.status === "published" ? "공개" : l.status}</td>
                      <td>{new Date(l.updatedAt).toLocaleString("ko-KR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <>
            <div className="card card-pad" style={{ marginBottom: 16 }}>
              <div className="field" style={{ marginBottom: 0, maxWidth: 320 }}>
                <label>리드폼 필터</label>
                <select
                  className="input"
                  value={formFilter}
                  onChange={(e) => setFormFilter(e.target.value === "" ? "" : Number(e.target.value))}
                >
                  <option value="">전체 (최신 200건)</option>
                  {forms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {leadsLoading || leads === null ? (
              <Loading />
            ) : leads.length === 0 ? (
              <div className="card card-pad empty-state">
                <p>리드가 없습니다.</p>
              </div>
            ) : (
              <div className="card card-table">
                <table>
                  <thead>
                    <tr>
                      <th>접수</th>
                      <th>리드폼</th>
                      <th>내용</th>
                      <th>상태</th>
                      <th>분야</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((l) => (
                      <tr key={l.id}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {new Date(l.createdAt).toLocaleString("ko-KR")}
                        </td>
                        <td>{formNames.get(l.formId) ?? `#${l.formId}`}</td>
                        <td>
                          {l.answers.map((a) => `${a.label}: ${a.value}`).join(" · ") || "-"}
                        </td>
                        <td>{STATUS_LABEL[l.status] ?? l.status}</td>
                        <td>{l.category ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
