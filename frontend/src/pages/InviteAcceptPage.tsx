import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { acceptInvite, ApiError, getInviteInfo, setTokens, type InviteInfo } from "../api/client";
import { TopBar } from "../components/TopBar";

/**
 * 초대 수락 화면 (비로그인 공개, `/invite/:token`).
 * 광고주가 카톡으로 받은 링크를 휴대폰으로 여는 경우가 많으므로 모바일 우선(입력 16px·풀폭 버튼).
 */
export function InviteAcceptPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getInviteInfo(token);
        if (!alive) return;
        setInfo(res);
        setName(res.name ?? "");
      } catch (e) {
        if (alive) setLoadError(e instanceof ApiError ? e.message : "초대 링크를 확인할 수 없습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (password !== password2) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await acceptInvite(token, {
        password,
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      // 역할에 맞는 화면으로 보낸다(광고주 → /client). 새로고침으로 인증 컨텍스트를 다시 읽는다.
      window.location.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "계정 만들기에 실패했습니다.");
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap auth-wrap">
        <div className="card card-pad auth-card">
          {loading ? (
            <p className="dash-sub">초대 확인 중…</p>
          ) : loadError ? (
            <>
              <p className="eyebrow">초대</p>
              <h1 className="auth-title">초대를 사용할 수 없습니다</h1>
              <p className="auth-error">{loadError}</p>
              <p className="auth-sub">
                링크가 만료되었거나 이미 사용되었을 수 있습니다. 초대해주신 담당자에게 재발급을 요청해주세요.
              </p>
              <button className="btn btn-ghost auth-submit" onClick={() => navigate("/login")}>
                로그인 화면으로
              </button>
            </>
          ) : (
            <>
              <p className="eyebrow">광고주 계정 만들기</p>
              <h1 className="auth-title">
                {info?.marketerCompany || info?.marketerName} 님이
                <br />
                초대했습니다
              </h1>
              <p className="auth-sub">비밀번호만 정하면 바로 리드를 확인할 수 있습니다.</p>

              <form onSubmit={onSubmit} noValidate>
                <div className="field">
                  <label htmlFor="inv-email">이메일 (아이디)</label>
                  <input id="inv-email" className="input" value={info?.email ?? ""} readOnly disabled />
                </div>
                <div className="field">
                  <label htmlFor="inv-name">이름</label>
                  <input
                    id="inv-name"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="담당자 이름"
                  />
                </div>
                <div className="field">
                  <label htmlFor="inv-phone">
                    연락처 <span className="field-optional">(선택)</span>
                  </label>
                  <input
                    id="inv-phone"
                    className="input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="numeric"
                    placeholder="01012345678"
                  />
                </div>
                <div className="field">
                  <label htmlFor="inv-pw">비밀번호</label>
                  <input
                    id="inv-pw"
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8자 이상"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="inv-pw2">비밀번호 확인</label>
                  <input
                    id="inv-pw2"
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    required
                  />
                </div>

                {error && <p className="auth-error">{error}</p>}

                <button className="btn btn-primary auth-submit" type="submit" disabled={submitting}>
                  {submitting ? "만드는 중…" : "계정 만들고 시작하기"}
                </button>
              </form>

              <p className="auth-switch">비밀번호는 본인만 알 수 있습니다(초대한 담당자도 볼 수 없습니다).</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
