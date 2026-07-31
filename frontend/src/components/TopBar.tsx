import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../lib/authContext";
import { useTheme, type Theme } from "../lib/useTheme";
import { LeadpotMark } from "./LeadpotMark";

const THEME_LABEL: Record<Theme, string> = {
  system: "🖥️ 시스템",
  light: "☀️ 라이트",
  dark: "🌙 다크",
};

type NavItem = { to: string; label: string; desc?: string };
type NavSection = { title?: string; items: NavItem[] };

/**
 * 좌측 내비(LNB) 구성 — 메뉴가 늘어나도 세로로 확장되고, 위계를 섹션으로 드러낸다.
 * 드롭다운과 달리 열어보지 않아도 어디에 무엇이 있는지 한눈에 보인다.
 */
const NAV: NavSection[] = [
  {
    items: [
      { to: "/dashboard", label: "대시보드" },
      { to: "/inbox", label: "리드" },
    ],
  },
  {
    title: "제작",
    items: [
      { to: "/forms", label: "리드폼", desc: "수집할 항목을 만듭니다" },
      { to: "/landings", label: "랜딩", desc: "공개할 페이지를 만듭니다" },
      { to: "/html-components", label: "요소", desc: "재사용할 HTML 조각을 관리합니다" },
      { to: "/consent-docs", label: "동의 문서", desc: "약관·개인정보 동의를 관리합니다" },
    ],
  },
  {
    title: "운영",
    items: [
      { to: "/advertisers", label: "광고주" },
      { to: "/stats", label: "통계" },
      { to: "/integrations", label: "연동", desc: "텔레그램·구글시트를 연결합니다" },
    ],
  },
];

/**
 * 앱 공통 내비 — 넓은 화면은 **좌측 사이드바(LNB)**, 좁은 화면(≤900px)은 상단 바 + 드로어.
 * `.app-shell` 이 넓은 화면에서 가로 배치가 되어 이 사이드바와 `main` 이 나란히 놓인다.
 */
export function TopBar() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [accountOpen, setAccountOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 광고주 하위계정에는 마케터 내비를 보여주지 않는다(서버에서도 접근이 차단되어 있다).
  const isMarketer = user?.role === "USER" || user?.role === "ADMIN";
  const showNav = !!user && isMarketer;

  // 경로가 바뀌면 열린 것들을 닫는다.
  useEffect(() => {
    setAccountOpen(false);
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!accountOpen && !drawerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setAccountOpen(false);
        setDrawerOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAccountOpen(false);
        setDrawerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [accountOpen, drawerOpen]);

  const account = user && (
    <div className="lnb-account">
      <button
        type="button"
        className={`account-btn${accountOpen ? " on" : ""}`}
        aria-expanded={accountOpen}
        onClick={() => setAccountOpen((v) => !v)}
      >
        <span className="account-avatar" aria-hidden="true">
          {user.email.slice(0, 1).toUpperCase()}
        </span>
        <span className="account-email">{user.email}</span>
        <span className="account-caret" aria-hidden="true">▾</span>
      </button>
      {accountOpen && (
        <div className="nav-menu" role="menu">
          <div className="nav-menu-head">{user.email}</div>
          <button type="button" className="nav-menu-item" role="menuitem" onClick={toggle}>
            {THEME_LABEL[theme]}
          </button>
          <button type="button" className="nav-menu-item danger" role="menuitem" onClick={logout}>
            로그아웃
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div ref={rootRef} className="app-nav" data-has-nav={showNav ? "true" : "false"}>
      {/* 넓은 화면: 좌측 사이드바 */}
      <aside className="lnb" aria-label="주요 메뉴">
        <Link to="/" className="brand lnb-brand" style={{ textDecoration: "none" }}>
          <LeadpotMark />
          Leadpot
        </Link>
        {showNav && (
          <nav className="lnb-nav">
            {NAV.map((section, i) => (
              <div key={section.title ?? i} className="lnb-section">
                {section.title && <div className="lnb-section-title">{section.title}</div>}
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => (isActive ? "lnb-link on" : "lnb-link")}
                  >
                    <span className="lnb-link-label">{item.label}</span>
                    {item.desc && <span className="lnb-link-desc">{item.desc}</span>}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        )}
        <div className="lnb-foot">{account}</div>
      </aside>

      {/* 좁은 화면: 상단 바 + 드로어 */}
      <div className="lnb-topbar">
        <div className="lnb-topbar-in">
          {showNav && (
            <button
              type="button"
              className="topbar-burger"
              aria-label="메뉴"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen((v) => !v)}
            >
              ☰
            </button>
          )}
          <Link to="/" className="brand" style={{ textDecoration: "none" }}>
            <LeadpotMark />
            Leadpot
          </Link>
          <div className="lnb-topbar-right">
            {user ? (
              account
            ) : (
              <button className="theme-btn" type="button" onClick={toggle}>
                {THEME_LABEL[theme]}
              </button>
            )}
          </div>
        </div>
        {drawerOpen && showNav && (
          <div className="lnb-drawer">
            {NAV.map((section, i) => (
              <div key={section.title ?? i} className="drawer-group">
                {section.title && <div className="drawer-group-title">{section.title}</div>}
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => (isActive ? "drawer-link on" : "drawer-link")}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
