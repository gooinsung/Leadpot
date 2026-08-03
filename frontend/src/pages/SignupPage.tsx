import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext";
import { ApiError } from "../api/client";
import { TopBar } from "../components/TopBar";
import { SiteFooter } from "../components/SiteFooter";

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setSubmitting(true);
    try {
      await signup({ email, password, name, phone: phone || undefined });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.fieldErrors) setFieldErrors(err.fieldErrors);
      } else {
        setError("회원가입에 실패했습니다.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap auth-wrap">
        <div className="card card-pad auth-card">
          <p className="eyebrow">회원가입</p>
          <h1 className="auth-title">리드팟 시작하기</h1>
          <p className="auth-sub">이메일로 계정을 만들어 랜딩·리드 수집을 시작하세요.</p>

          <form onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="name">이름 <span className="req">*</span></label>
              <input
                id="name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                required
              />
              {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
            </div>
            <div className="field">
              <label htmlFor="email">이메일 <span className="req">*</span></label>
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
              {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
            </div>
            <div className="field">
              <label htmlFor="password">비밀번호 <span className="req">*</span></label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8자 이상"
                required
              />
              {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
            </div>
            <div className="field">
              <label htmlFor="phone">연락처 <span className="field-optional">(선택)</span></label>
              <input
                id="phone"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-0000-0000"
              />
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button className="btn btn-primary auth-submit" type="submit" disabled={submitting}>
              {submitting ? "가입 중…" : "회원가입"}
            </button>
          </form>

          <p className="auth-switch">
            이미 계정이 있으신가요? <Link to="/login">로그인</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
