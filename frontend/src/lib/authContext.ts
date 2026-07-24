import { createContext, useContext } from "react";
import type { AuthUser, LoginInput, SignupInput } from "../api/client";

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean; // 최초 세션 복원 중 여부
  login: (input: LoginInput) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => void;
  updateUser: (user: AuthUser) => void; // 계정 정보 부분 갱신(서브도메인 변경 등)
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 는 AuthProvider 안에서만 사용할 수 있습니다.");
  return ctx;
}
