import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { getAdvertiserMe, type AdvertiserMe } from "../api/client";
import { useAuth } from "../lib/authContext";
import { useTheme, type Theme } from "../lib/useTheme";
import { LeadpotMark } from "./LeadpotMark";

const THEME_LABEL: Record<Theme, string> = {
  system: "🖥️",
  light: "☀️",
  dark: "🌙",
};

const NAV = [
  { to: "/client", label: "리드", end: true },
  { to: "/client/report", label: "리포트", end: false },
  { to: "/client/integrations", label: "알림 설정", end: false },
];

/**
 * 광고주 포털 상단바. 마케터 내비를 전혀 두지 않는다.
 * 소속 마케터가 로고·색상(화이트라벨)을 설정해두면 그것을 우선 표시한다.
 *
 * ⚠️ 전용 클래스(`adv-*`)를 쓴다 — 예전에는 마케터와 같은 `.topbar-*`·`.nav-link` 를
 * 공유했는데, 마케터 내비가 LNB 로 바뀌면서(U4) 그 클래스들이 사라져 이 화면만
 * 스타일이 빠져 있었다. 두 포털은 구조가 다르므로 앞으로도 공유하지 않는다.
 *
 * 광고주는 현장에서 폰으로 보는 일이 많아 **모바일 우선**으로 짠다(U6).
 */
export function AdvertiserTopBar() {
  const { logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [me, setMe] = useState<AdvertiserMe | null>(null);

  useEffect(() => {
    getAdvertiserMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const brandName = me?.marketerCompany || me?.marketerName;

  return (
    <header className="adv-bar" style={me?.brandColor ? { borderBottomColor: me.brandColor } : undefined}>
      <div className="adv-bar-in">
        <div className="adv-bar-top">
          <span className="adv-brand">
            {me?.brandLogoUrl ? (
              <img src={me.brandLogoUrl} alt={brandName ?? "로고"} className="brand-logo" />
            ) : (
              <LeadpotMark />
            )}
            <span className="adv-brand-name">{brandName ?? "Leadpot"}</span>
          </span>
          <div className="adv-actions">
            {me && <span className="adv-who">{me.company || me.name}</span>}
            <button className="adv-icon-btn" type="button" onClick={toggle} aria-label="테마 전환">
              {THEME_LABEL[theme]}
            </button>
            <button
              className="adv-icon-btn"
              type="button"
              onClick={() => {
                logout();
                // 광고주는 회원가입 링크가 없는 전용 로그인 화면으로 보낸다
                window.location.replace("/client/login");
              }}
            >
              로그아웃
            </button>
          </div>
        </div>
        <nav className="adv-nav" aria-label="주요 메뉴">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => (isActive ? "adv-nav-link on" : "adv-nav-link")}
              style={({ isActive }) => (isActive && me?.brandColor ? { background: me.brandColor, borderColor: me.brandColor } : undefined)}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
