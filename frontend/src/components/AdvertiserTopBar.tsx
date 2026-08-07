import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { getAdvertiserMe, type AdvertiserMe } from "../api/client";
import { useAuth } from "../lib/authContext";
import { useTheme, type Theme } from "../lib/useTheme";

const THEME_LABEL: Record<Theme, string> = {
  system: "🖥️",
  light: "☀️",
  dark: "🌙",
};

const NAV = [
  { to: "/client", label: "리드", end: true },
  { to: "/client/report", label: "리포트", end: false },
  { to: "/client/integrations", label: "설정", end: false },
  { to: "/client/guide", label: "사용 안내", end: false },
];

/**
 * 광고주 포털 내비 — 넓은 화면은 마케터처럼 <b>좌측 사이드바</b>(2026-08-08 사용자 요청),
 * 좁은 화면(≤900px)은 기존 상단바+알약 탭을 유지한다(광고주는 폰 사용이 많다, U6).
 * 전환은 advertiser.css 의 미디어쿼리가 담당한다 — DOM 은 하나다.
 *
 * 마케터 내비를 전혀 두지 않고, 소속 마케터의 로고·색상(화이트라벨)을 우선 표시한다.
 *
 * ⚠️ 전용 클래스(`adv-*`)를 쓴다 — 예전에는 마케터와 같은 `.topbar-*`·`.nav-link` 를
 * 공유했는데, 마케터 내비가 LNB 로 바뀌면서(U4) 그 클래스들이 사라져 이 화면만
 * 스타일이 빠져 있었다. 두 포털은 구조가 다르므로 앞으로도 공유하지 않는다.
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
          {/* 광고주에게는 마케터 브랜드만 보여준다 — 리드팟 로고를 넣지 않는다(화이트라벨).
              마케터가 로고를 등록하지 않았으면 이름만 나온다. */}
          <span className="adv-brand">
            {me?.brandLogoUrl && (
              <img src={me.brandLogoUrl} alt={brandName ?? "로고"} className="brand-logo" />
            )}
            <span className="adv-brand-name">{brandName ?? "리드 관리"}</span>
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
