import { Navigate, useLocation } from "react-router-dom";
import { Loading } from "./Loading";
import type { ReactNode } from "react";
import { useAuth } from "../lib/authContext";
import { getTokens, type Role } from "../api/client";

/** 역할별 기본 진입 화면. */
export function homePathFor(role: Role | undefined): string {
  return role === "ADVERTISER" ? "/client" : "/dashboard";
}

/** 역할별 로그인 화면. 광고주는 회원가입 링크가 없는 전용 화면으로 보낸다. */
export function loginPathFor(role: Role | undefined): string {
  return role === "ADVERTISER" ? "/client/login" : "/login";
}

/**
 * 인증이 필요한 라우트 가드 (K5 접근권한의 진입점).
 *
 * 미로그인 → /login. 역할이 맞지 않으면 자기 역할의 기본 화면으로 보낸다.
 * 예: 광고주가 마케터 화면 URL 을 직접 입력해도 /client 로 튕긴다.
 * ⚠️ 화면 가드는 편의일 뿐이고 실제 차단은 서버(SecurityConfig 경로 화이트리스트)가 한다.
 */
export function ProtectedRoute({
  children,
  role = "USER",
}: {
  children: ReactNode;
  /** 이 라우트에 필요한 역할. 기본은 마케터(USER). */
  role?: Role;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loading full />;
  }
  // 토큰은 있는데 세션 복원에 실패한 경우 = 서버에 닿지 못한 것(재배포 중 등).
  // 로그인 화면으로 내쫓지 않고 다시 시도할 기회를 준다 — 로그아웃된 게 아니다.
  if (!user && getTokens()) {
    return (
      <div className="page-loading" style={{ flexDirection: "column", gap: 14 }}>
        <p>서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          다시 시도
        </button>
      </div>
    );
  }
  if (!user) {
    return <Navigate to={loginPathFor(role)} state={{ from: location.pathname }} replace />;
  }
  // 관리자는 마케터 화면을 함께 쓸 수 있다.
  const allowed = role === "USER" ? user.role === "USER" || user.role === "ADMIN" : user.role === role;
  if (!allowed) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }
  return <>{children}</>;
}

/** 로그인 상태에 따라 역할별 기본 화면으로 보내는 루트(`/`) 처리. */
export function RoleHomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return <Loading full />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={homePathFor(user.role)} replace />;
}
