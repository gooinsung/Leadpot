import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext";
import { ApiError, getClientBrand } from "../api/client";
import { LeadpotMark } from "../components/LeadpotMark";
import { useTheme, type Theme } from "../lib/useTheme";

const THEME_LABEL: Record<Theme, string> = { system: "🖥️", light: "☀️", dark: "🌙" };

/**
 * 광고주 전용 로그인 (`/client/login`).
 *
 * 마케터 로그인(`/login`)과 분리한 이유:
 * 1) 마케터 로그인 화면에는 <b>회원가입 링크</b>가 있다. 광고주가 그걸 눌러 가입하면
 *    엉뚱한 <b>마케터 계정</b>이 새로 생기고, 로그인은 되는데 리드가 없는 상태가 된다.
 * 2) 비밀번호 분실 시 안내가 다르다(광고주는 담당 마케터에게 재설정 링크를 요청해야 한다).
 * 3) 담당 마케터 이름을 보여줄 수 있어 광고주가 "어디에 로그인하는지" 알 수 있다(화이트라벨 1단계).
 *
 * 마케터가 실수로 여기 로그인해도 막지 않고 조용히 자기 화면으로 보낸다(에러 표시 없음).
 */
export function ClientLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const brand = getClientBrand();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await login({ email, password });
      // 역할에 맞는 화면으로. 마케터가 들어와도 에러 없이 대시보드로 보낸다.
      navigate(user.role === "ADVERTISER" ? "/client" : "/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "로그인에 실패했습니다.");
      setSubmitting(false);
    }
  }

  const brandName = brand?.marketerCompany || brand?.marketerName;

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
          <div className="topbar-actions">
            <button className="theme-btn" type="button" onClick={toggle} aria-label="테마 전환">
              {THEME_LABEL[theme]}
            </button>
          </div>
        </div>
      </header>

      <main className="wrap auth-wrap">
        <div className="card card-pad auth-card">
          <p className="eyebrow">광고주 로그인</p>
          <h1 className="auth-title">
            {brandName ? `${brandName} 리드 확인` : "리드 확인 로그인"}
          </h1>
          <p className="auth-sub">담당자에게 받은 계정으로 로그인하세요.</p>

          <form onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="cl-email">이메일</label>
              <input
                id="cl-email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="cl-pw">비밀번호</label>
              <input
                id="cl-pw"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                required
              />
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button className="btn btn-primary auth-submit" type="submit" disabled={submitting}>
              {submitting ? "로그인 중…" : "로그인"}
            </button>
          </form>

          {/* ⚠️ 회원가입 링크를 두지 않는다 — 광고주가 마케터 계정을 만들어버리는 사고를 막는다. */}
          <p className="auth-switch">
            비밀번호를 잊으셨나요?
            <br />
            {brandName ? `${brandName} 담당자` : "담당 마케터"}에게 <strong>재설정 링크</strong>를 요청해주세요.
          </p>
        </div>
      </main>
    </div>
  );
}
