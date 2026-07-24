import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
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

  // 새로고침 시: 저장된 토큰이 있으면 /me 로 세션 복원
  useEffect(() => {
    const tokens = getTokens();
    if (!tokens) {
      setLoading(false);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const res = await apiLogin(input);
    setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
    setUser(res.user);
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
