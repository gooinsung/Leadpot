import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getBusinessProfile, saveBusinessProfile, type BusinessProfile } from "../api/client";
import { Loading } from "../components/Loading";
import { TopBar } from "../components/TopBar";
import { useAuth } from "../lib/authContext";
import { toast } from "../lib/toast";

const FIELDS: { key: keyof BusinessProfile; label: string; placeholder: string }[] = [
  { key: "companyName", label: "상호", placeholder: "라이징마케팅" },
  { key: "ceoName", label: "대표자", placeholder: "홍길동" },
  { key: "bizNo", label: "사업자등록번호", placeholder: "000-00-00000" },
  { key: "address", label: "사업장 주소", placeholder: "서울시 강남구 …" },
  { key: "phone", label: "연락처", placeholder: "010-0000-0000" },
  { key: "email", label: "이메일", placeholder: "hello@example.com" },
  { key: "bankAccount", label: "입금 계좌", placeholder: "국민은행 000-00-0000 홍길동" },
];

/**
 * 마이페이지('내 정보'). 지금은 **사업장 정보**만 둔다 — 견적서 공급자 칸에 자동으로 들어간다
 * (사용자 결정 2026-10-29: 사업장 정보는 견적서 화면이 아니라 마이페이지에서 관리).
 */
export function AccountPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<BusinessProfile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getBusinessProfile()
      .then(setForm)
      .catch((e) => toast.error(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }, []);

  async function onSave() {
    if (!form || saving) return;
    setSaving(true);
    try {
      setForm(await saveBusinessProfile(form));
      toast.success("사업장 정보를 저장했습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">내 정보</p>
            <h1 className="dash-title">마이페이지</h1>
            <p className="dash-sub">{user?.email}</p>
          </div>
        </div>

        <div className="card card-pad account-card">
          <div className="card-h">사업장 정보</div>
          <p className="dash-sub" style={{ marginTop: 0 }}>
            <Link to="/quotes">견적서</Link>의 <b>공급자 칸</b>에 자동으로 들어갑니다. 이미 발행한 견적서는 바뀌지 않습니다.
          </p>
          {!form ? (
            <Loading />
          ) : (
            <>
              <div className="account-grid">
                {FIELDS.map((f) => (
                  <div className={`field${f.key === "address" || f.key === "bankAccount" ? " span-2" : ""}`} key={f.key}>
                    <label htmlFor={`bp-${f.key}`}>{f.label}</label>
                    <input
                      id={`bp-${f.key}`}
                      className="input"
                      value={form[f.key]}
                      placeholder={f.placeholder}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn btn-primary" disabled={saving} onClick={onSave}>
                  {saving ? "저장 중…" : "저장"}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
