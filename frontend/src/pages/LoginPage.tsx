import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext";
import { ApiError } from "../api/client";
import { TopBar } from "../components/TopBar";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "로그인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap auth-wrap">
        <div className="card card-pad auth-card">
          <p className="eyebrow">로그인</p>
          <h1 className="auth-title">다시 오신 걸 환영해요</h1>
          <p className="auth-sub">리드팟 계정으로 로그인하세요.</p>

          <form onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="email">이메일</label>
              <input
                id="email"
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
              <label htmlFor="password">비밀번호</label>
              <input
                id="password"
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

          {/* 비밀번호 재설정(V36) — 가입 휴대폰으로 인증번호를 받아 직접 바꾼다. */}
          <p className="auth-switch">
            <Link to="/reset-password">비밀번호를 잊으셨나요?</Link>
          </p>

          {/* 공개 회원가입 닫힘(2026-08-06) — 계정은 운영자가 직접 만든다. 다시 열 때 이 문단을
              /signup 링크로 되돌리고 App.tsx 의 라우트·서버 설정도 함께 되돌린다. */}
          <p className="auth-switch">
            계정이 필요하신가요? 운영자에게 문의해주세요.
          </p>
        </div>
      </main>
    </div>
  );
}
