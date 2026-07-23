import { Link } from "react-router-dom";
import { useAuth } from "../lib/authContext";
import { useTheme, type Theme } from "../lib/useTheme";
import { LeadpotMark } from "./LeadpotMark";

const THEME_LABEL: Record<Theme, string> = {
  system: "🖥️ 시스템",
  light: "☀️ 라이트",
  dark: "🌙 다크",
};

/** 모든 화면 상단 공통 바: 로고 · 테마전환 · (로그인 시)계정/로그아웃. */
export function TopBar() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();

  return (
    <header className="topbar">
      <div className="wrap topbar-in">
        <Link to="/" className="brand" style={{ textDecoration: "none" }}>
          <LeadpotMark />
          Leadpot
        </Link>
        <div className="topbar-actions">
          {user && <span className="topbar-email">{user.email}</span>}
          <button className="theme-btn" type="button" onClick={toggle}>
            {THEME_LABEL[theme]}
          </button>
          {user && (
            <button className="theme-btn" type="button" onClick={logout}>
              로그아웃
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
