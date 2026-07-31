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

/**
 * 내비 구성(U4) — 매일 쓰는 것만 최상위에 두고 나머지는 묶는다(사용자 확정).
 * 최상위: 대시보드 · 리드 · 광고주 · 통계 / 묶음: 제작 · 설정
 */
const TOP_LINKS = [
  { to: "/dashboard", label: "대시보드" },
  { to: "/inbox", label: "리드" },
];
const BUILD_LINKS = [
  { to: "/forms", label: "리드폼", desc: "수집할 항목을 만든다" },
  { to: "/landings", label: "랜딩", desc: "공개할 페이지를 만든다" },
  { to: "/html-components", label: "요소", desc: "재사용 HTML 조각" },
  { to: "/consent-docs", label: "동의 문서", desc: "약관·개인정보 동의" },
];
const TAIL_LINKS = [
  { to: "/advertisers", label: "광고주" },
  { to: "/stats", label: "통계" },
];
const SETTING_LINKS = [{ to: "/integrations", label: "연동", desc: "텔레그램·구글시트" }];

/** 모든 화면 상단 공통 바: 로고 · 내비(그룹핑) · 계정 메뉴. 좁은 화면은 햄버거 드로어. */
export function TopBar() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState<"build" | "settings" | "account" | "drawer" | null>(null);
  const barRef = useRef<HTMLElement>(null);

  // 광고주 하위계정에는 마케터 내비를 보여주지 않는다(서버에서도 접근이 차단되어 있다).
  const isMarketer = user?.role === "USER" || user?.role === "ADMIN";

  // 경로가 바뀌면 열린 메뉴를 닫는다(링크를 눌렀을 때 자연스럽게 닫히도록).
  useEffect(() => setOpen(null), [pathname]);

  // 바깥 클릭·ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const groupActive = (links: { to: string }[]) => links.some((l) => isActive(l.to));

  return (
    <header className="topbar" ref={barRef}>
      <div className="wrap topbar-in">
        <div className="topbar-left">
          <Link to="/" className="brand" style={{ textDecoration: "none" }}>
            <LeadpotMark />
            Leadpot
          </Link>

          {user && isMarketer && (
            <nav className="topbar-nav" aria-label="주요 메뉴">
              {TOP_LINKS.map((l) => (
                <NavLink key={l.to} to={l.to} className={({ isActive: a }) => (a ? "nav-link on" : "nav-link")}>
                  {l.label}
                </NavLink>
              ))}

              <NavGroup
                label="제작"
                links={BUILD_LINKS}
                open={open === "build"}
                active={groupActive(BUILD_LINKS)}
                onToggle={() => setOpen(open === "build" ? null : "build")}
                isActive={isActive}
              />

              {TAIL_LINKS.map((l) => (
                <NavLink key={l.to} to={l.to} className={({ isActive: a }) => (a ? "nav-link on" : "nav-link")}>
                  {l.label}
                </NavLink>
              ))}

              <NavGroup
                label="설정"
                links={SETTING_LINKS}
                open={open === "settings"}
                active={groupActive(SETTING_LINKS)}
                onToggle={() => setOpen(open === "settings" ? null : "settings")}
                isActive={isActive}
              />
            </nav>
          )}
        </div>

        <div className="topbar-actions">
          {user && isMarketer && (
            <button
              type="button"
              className="topbar-burger"
              aria-label="메뉴"
              aria-expanded={open === "drawer"}
              onClick={() => setOpen(open === "drawer" ? null : "drawer")}
            >
              ☰
            </button>
          )}

          {user ? (
            <div className="nav-group">
              <button
                type="button"
                className={`account-btn${open === "account" ? " on" : ""}`}
                aria-expanded={open === "account"}
                onClick={() => setOpen(open === "account" ? null : "account")}
              >
                <span className="account-avatar" aria-hidden="true">
                  {user.email.slice(0, 1).toUpperCase()}
                </span>
                <span className="account-caret" aria-hidden="true">▾</span>
              </button>
              {open === "account" && (
                <div className="nav-menu nav-menu-right" role="menu">
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
          ) : (
            <button className="theme-btn" type="button" onClick={toggle}>
              {THEME_LABEL[theme]}
            </button>
          )}
        </div>
      </div>

      {/* 좁은 화면: 전체 메뉴를 한 번에 펼친다(가로 스크롤로 훑지 않게) */}
      {open === "drawer" && user && isMarketer && (
        <div className="topbar-drawer">
          <div className="wrap">
            <DrawerGroup title="" links={TOP_LINKS} isActive={isActive} />
            <DrawerGroup title="제작" links={BUILD_LINKS} isActive={isActive} />
            <DrawerGroup title="" links={TAIL_LINKS} isActive={isActive} />
            <DrawerGroup title="설정" links={SETTING_LINKS} isActive={isActive} />
          </div>
        </div>
      )}
    </header>
  );
}

function NavGroup({
  label,
  links,
  open,
  active,
  onToggle,
  isActive,
}: {
  label: string;
  links: { to: string; label: string; desc?: string }[];
  open: boolean;
  active: boolean;
  onToggle: () => void;
  isActive: (to: string) => boolean;
}) {
  return (
    <div className="nav-group">
      <button
        type="button"
        className={`nav-link nav-link-btn${active ? " on" : ""}`}
        aria-expanded={open}
        onClick={onToggle}
      >
        {label}
        <span className="nav-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="nav-menu" role="menu">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              role="menuitem"
              className={`nav-menu-item${isActive(l.to) ? " on" : ""}`}
            >
              <span className="nav-menu-label">{l.label}</span>
              {l.desc && <span className="nav-menu-desc">{l.desc}</span>}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function DrawerGroup({
  title,
  links,
  isActive,
}: {
  title: string;
  links: { to: string; label: string }[];
  isActive: (to: string) => boolean;
}) {
  return (
    <div className="drawer-group">
      {title && <div className="drawer-group-title">{title}</div>}
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} className={`drawer-link${isActive(l.to) ? " on" : ""}`}>
          {l.label}
        </NavLink>
      ))}
    </div>
  );
}
