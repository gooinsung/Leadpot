import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  completePasswordReset,
  getPasswordResetInfo,
  rememberClientBrand,
  setTokens,
  type PasswordResetInfo,
} from "../api/client";
import { LeadpotMark } from "../components/LeadpotMark";

/**
 * 광고주 비밀번호 재설정 (`/client/reset/:token`, 비로그인 공개).
 * 담당 마케터가 발급한 링크로 들어와 새 비밀번호를 직접 정한다.
 * 휴대폰에서 여는 경우가 많아 모바일 우선.
 */
export function ClientResetPasswordPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();

  const [info, setInfo] = useState<PasswordResetInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getPasswordResetInfo(token);
        if (!alive) return;
        setInfo(res);
        rememberClientBrand({ marketerName: res.marketerName, marketerCompany: res.marketerCompany });
      } catch (e) {
        if (alive) setLoadError(e instanceof ApiError ? e.message : "링크를 확인할 수 없습니다.");
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
      const res = await completePasswordReset(token, password);
      setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      window.location.replace("/client");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "변경에 실패했습니다.");
      setSubmitting(false);
    }
  }

  const brandName = info?.marketerCompany || info?.marketerName;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="wrap topbar-in">
          <div className="topbar-left">
            <span className="brand">
              <LeadpotMark />
              {brandName ?? "Leadpot"}
            </span>
          </div>
        </div>
      </header>

      <main className="wrap auth-wrap">
        <div className="card card-pad auth-card">
          {loading ? (
            <p className="dash-sub">링크 확인 중…</p>
          ) : loadError ? (
            <>
              <p className="eyebrow">비밀번호 재설정</p>
              <h1 className="auth-title">링크를 사용할 수 없습니다</h1>
              <p className="auth-error">{loadError}</p>
              <p className="auth-sub">
                링크가 만료되었거나 이미 사용되었습니다. 담당자에게 새 링크를 요청해주세요.
              </p>
              <button className="btn btn-ghost auth-submit" onClick={() => navigate("/client/login")}>
                로그인 화면으로
              </button>
            </>
          ) : (
            <>
              <p className="eyebrow">비밀번호 재설정</p>
              <h1 className="auth-title">새 비밀번호 설정</h1>
              <p className="auth-sub">
                <strong>{info?.email}</strong> 계정의 비밀번호를 새로 정해주세요.
              </p>

              <form onSubmit={onSubmit} noValidate>
                <div className="field">
                  <label htmlFor="rs-pw">새 비밀번호</label>
                  <input
                    id="rs-pw"
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
                  <label htmlFor="rs-pw2">새 비밀번호 확인</label>
                  <input
                    id="rs-pw2"
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
                  {submitting ? "변경 중…" : "비밀번호 변경하고 시작하기"}
                </button>
              </form>

              <p className="auth-switch">비밀번호는 본인만 알 수 있습니다(담당자도 볼 수 없습니다).</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
