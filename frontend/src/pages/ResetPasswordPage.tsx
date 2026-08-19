import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError, confirmPasswordReset, requestPasswordReset, setTokens } from "../api/client";
import { TopBar } from "../components/TopBar";

/** 재발송 버튼 잠금 시간(초). 서버 쿨다운(PasswordResetService.RESEND_COOLDOWN)과 같게 유지한다. */
const RESEND_SECONDS = 60;

/**
 * 마케터 비밀번호 재설정 (`/reset-password`, 비로그인 공개) — 로그인 화면의 "비밀번호를 잊으셨나요?".
 *
 * 이메일을 넣으면 **가입 때 등록한 휴대폰**으로 6자리 인증번호 문자가 온다.
 * 서버는 계정 존재 여부를 알려주지 않으므로(보안) 이 화면도 "등록된 계정이면 발송됐다"로만 안내한다.
 * 광고주는 이 흐름이 아니라 담당 마케터가 발급한 링크(`/client/reset/:token`)를 쓴다.
 */
export function ResetPasswordPage() {
  const [step, setStep] = useState<"email" | "confirm">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resendLeft, setResendLeft] = useState(0);

  // 재발송 잠금 카운트다운
  useEffect(() => {
    if (resendLeft <= 0) return;
    const t = setInterval(() => setResendLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendLeft > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendCode() {
    setError("");
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setStep("confirm");
      setResendLeft(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "요청을 처리하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onRequestSubmit(e: FormEvent) {
    e.preventDefault();
    await sendCode();
  }

  async function onConfirmSubmit(e: FormEvent) {
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
      const res = await confirmPasswordReset(email, code.trim(), password);
      setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      // 전체 리로드로 인증 컨텍스트를 새로 세운다(광고주 재설정 화면과 같은 방식).
      window.location.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "변경에 실패했습니다.");
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap auth-wrap">
        <div className="card card-pad auth-card">
          <p className="eyebrow">비밀번호 재설정</p>

          {step === "email" ? (
            <>
              <h1 className="auth-title">비밀번호를 잊으셨나요?</h1>
              <p className="auth-sub">
                가입 이메일을 입력하면 <strong>등록된 휴대폰으로 인증번호</strong>를 보내드립니다.
              </p>

              <form onSubmit={onRequestSubmit} noValidate>
                <div className="field">
                  <label htmlFor="rp-email">이메일</label>
                  <input
                    id="rp-email"
                    className="input"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>

                {error && <p className="auth-error">{error}</p>}

                <button
                  className="btn btn-primary auth-submit"
                  type="submit"
                  disabled={submitting || !email.trim()}
                >
                  {submitting ? "발송 중…" : "인증번호 받기"}
                </button>
              </form>

              <p className="auth-switch">
                <Link to="/login">로그인으로 돌아가기</Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="auth-title">인증번호 입력</h1>
              <p className="auth-sub">
                <strong>{email}</strong> 이 등록된 계정이면 휴대폰으로 인증번호를 보냈습니다.
                10분 안에 입력해주세요.
              </p>

              <form onSubmit={onConfirmSubmit} noValidate>
                <div className="field">
                  <label htmlFor="rp-code">인증번호 (6자리)</label>
                  <input
                    id="rp-code"
                    className="input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="123456"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="rp-pw">새 비밀번호</label>
                  <input
                    id="rp-pw"
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
                  <label htmlFor="rp-pw2">새 비밀번호 확인</label>
                  <input
                    id="rp-pw2"
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    required
                  />
                </div>

                {error && <p className="auth-error">{error}</p>}

                <button
                  className="btn btn-primary auth-submit"
                  type="submit"
                  disabled={submitting || code.length !== 6}
                >
                  {submitting ? "변경 중…" : "비밀번호 변경하고 로그인"}
                </button>
              </form>

              <p className="auth-switch">
                문자가 오지 않았나요?{" "}
                {resendLeft > 0 ? (
                  <span>{resendLeft}초 후 재발송할 수 있습니다.</span>
                ) : (
                  <button type="button" className="btn-link" onClick={sendCode} disabled={submitting}>
                    인증번호 재발송
                  </button>
                )}
              </p>
              <p className="auth-switch">
                휴대폰이 등록돼 있지 않거나 번호가 바뀌었다면 운영자에게 문의해주세요.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
