"use client";
import { useEffect, useRef, useState } from "react";
import { ApiError, confirmPhoneCode, sendPhoneCode } from "../api/client";
import { isMobileDigits, phoneDigits, type PhoneVerifyState } from "../lib/phoneVerify";

/**
 * 리드폼 휴대폰 본인인증 칸(V48) — 첫 번째 연락처 항목 바로 아래에 붙는다.
 *
 * [인증번호 받기] → 6자리 입력 + 남은 시간 → [확인] → "✓ 인증 완료".
 * 상태는 부모(PublicFormView)가 들고 있다 — 스텝형에서 '이전'으로 갔다 와서 이 칸이 다시 그려져도
 * 인증이 풀리지 않게 하기 위해서다. 상태에 번호를 같이 담아 두고, 입력한 번호가 바뀌면
 * 그 상태는 무효로 본다(다시 인증).
 *
 * 문자를 보내지 못하면(서버 FALLBACK) 접수를 막지 않고 인증 없이 받는다 — 사용자 결정(2026-11-09).
 *
 * 모바일 우선: 입력 16px(iOS 자동 확대 방지) · 큰 버튼 · `autocomplete="one-time-code"` 로
 * 문자로 온 번호가 키보드 위에 바로 뜬다.
 */
export function PhoneVerifyBox({
  formId,
  phone,
  state,
  onState,
  accent,
}: {
  formId: number;
  /** 연락처 칸에 입력된 값(하이픈 포함 가능). */
  phone: string;
  state: PhoneVerifyState | null;
  onState: (s: PhoneVerifyState | null) => void;
  accent: string;
}) {
  const digits = phoneDigits(phone);
  // 다른 번호로 받은 상태는 이 번호에는 무효다.
  const cur = state && state.phone === digits ? state : null;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const codeRef = useRef<HTMLInputElement>(null);

  // 번호가 바뀌면 입력하던 인증번호·에러를 비운다.
  useEffect(() => {
    setCode("");
    setError("");
  }, [digits]);

  // 남은 시간·재전송 대기 표시용 1초 시계 — 인증번호 입력 대기 중에만 돈다.
  const waiting = cur?.stage === "sent";
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waiting]);

  async function send() {
    if (!isMobileDigits(digits)) {
      setError("휴대폰 번호를 정확히 입력해주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await sendPhoneCode(formId, digits);
      const at = Date.now();
      if (r.mode === "FALLBACK" && r.token) {
        onState({ phone: digits, stage: "fallback", token: r.token, expiresAt: 0, resendAt: 0 });
        return;
      }
      setCode("");
      setNow(at);
      onState({ phone: digits, stage: "sent", token: null, expiresAt: at + r.codeTtlSeconds * 1000, resendAt: at + r.cooldownSeconds * 1000 });
      setTimeout(() => codeRef.current?.focus(), 0);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "인증번호를 보내지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!cur) return;
    const c = code.replace(/\D/g, "");
    if (c.length !== 6) {
      setError("인증번호 6자리를 입력해주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await confirmPhoneCode(formId, digits, c);
      onState({ ...cur, stage: "verified", token: r.token });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "인증에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (cur?.stage === "verified") {
    return <div className="pv-done" style={{ color: accent }}>✓ 휴대폰 인증 완료</div>;
  }
  if (cur?.stage === "fallback") {
    return <div className="pv-note">지금은 인증 문자를 보낼 수 없어 인증 없이 접수됩니다.</div>;
  }

  const sent = cur?.stage === "sent";
  const left = sent ? Math.max(0, Math.ceil((cur.expiresAt - now) / 1000)) : 0;
  const resendLeft = sent ? Math.max(0, Math.ceil((cur.resendAt - now) / 1000)) : 0;
  const expired = sent && left === 0;

  return (
    <div className="pv">
      {!sent ? (
        <button type="button" className="pv-btn" style={{ background: accent }} disabled={busy || !digits} onClick={send}>
          {busy ? "보내는 중…" : "인증번호 받기"}
        </button>
      ) : (
        <>
          <div className="pv-row">
            <div className="pv-code-wrap">
              <input
                ref={codeRef}
                className="input pv-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="인증번호 6자리"
                aria-label="인증번호"
                value={code}
                disabled={expired}
                onChange={(e) => {
                  setError("");
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                }}
              />
              {!expired && <span className="pv-timer">{formatLeft(left)}</span>}
            </div>
            <button type="button" className="pv-btn pv-btn-confirm" style={{ background: accent }} disabled={busy || expired || code.length !== 6} onClick={confirm}>
              {busy ? "확인 중…" : "확인"}
            </button>
          </div>
          <div className="pv-sub">
            {expired ? <span>인증번호가 만료되었습니다.</span> : <span>문자로 받은 인증번호를 입력해주세요.</span>}
            <button type="button" className="pv-resend" disabled={busy || resendLeft > 0} onClick={send}>
              {resendLeft > 0 ? `재전송 (${resendLeft}초)` : "인증번호 다시 받기"}
            </button>
          </div>
        </>
      )}
      {error && <p className="pv-error">{error}</p>}
    </div>
  );
}

function formatLeft(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
