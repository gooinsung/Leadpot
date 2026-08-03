import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ApiError,
  clearTokens,
  getMe,
  getTokens,
  login as apiLogin,
  setTokens,
  signup as apiSignup,
  type AuthUser,
  type LoginInput,
  type SignupInput,
} from "../api/client";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * 새로고침 시: 저장된 토큰이 있으면 /me 로 세션 복원.
   *
   * ⚠️ 예전엔 실패하면 무조건 토큰을 지웠다. 그래서 **백엔드를 재배포하는 2~4분 동안
   * (API 502) 접속한 사람은 전부 로그아웃**됐다. 인증이 실제로 거부된 경우(401/403)만
   * 로그아웃하고, 서버에 닿지 못한 것뿐이면 토큰을 지키고 잠깐 재시도한다.
   */
  useEffect(() => {
    const tokens = getTokens();
    if (!tokens) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const attempt = async (left: number): Promise<void> => {
      try {
        const me = await getMe();
        if (!cancelled) setUser(me);
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0;
        if (status === 401 || status === 403) {
          clearTokens(); // 진짜 만료·거부 → 로그아웃
          return;
        }
        if (left > 0 && !cancelled) {
          await new Promise((r) => setTimeout(r, 1200));
          return attempt(left - 1);
        }
        // 서버에 닿지 못했을 뿐이므로 토큰은 남긴다 — 서버가 돌아온 뒤 새로고침하면 그대로 로그인된다.
      }
    };

    attempt(2).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const res = await apiLogin(input);
    setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
    setUser(res.user);
    return res.user;
  }, []);

  const signup = useCallback(async (input: SignupInput) => {
    const res = await apiSignup(input);
    setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const updateUser = useCallback((next: AuthUser) => {
    setUser(next);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
