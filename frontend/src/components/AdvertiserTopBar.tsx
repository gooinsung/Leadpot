import { useEffect, useState } from "react";
import { getAdvertiserMe, type AdvertiserMe } from "../api/client";
import { useAuth } from "../lib/authContext";
import { useTheme, type Theme } from "../lib/useTheme";
import { LeadpotMark } from "./LeadpotMark";

const THEME_LABEL: Record<Theme, string> = {
  system: "🖥️",
  light: "☀️",
  dark: "🌙",
};

/**
 * 광고주 포털 상단바. 마케터 내비를 전혀 두지 않는다.
 * 소속 마케터가 로고·색상(화이트라벨)을 설정해두면 그것을 우선 표시한다.
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
    <header className="topbar" style={me?.brandColor ? { borderBottomColor: me.brandColor } : undefined}>
      <div className="wrap topbar-in">
        <div className="topbar-left">
          <span className="brand">
            {me?.brandLogoUrl ? (
              <img src={me.brandLogoUrl} alt={brandName ?? "로고"} className="brand-logo" />
            ) : (
              <LeadpotMark />
            )}
            {brandName ?? "Leadpot"}
          </span>
        </div>
        <div className="topbar-actions">
          {me && <span className="topbar-email">{me.company || me.name}</span>}
          <button className="theme-btn" type="button" onClick={toggle} aria-label="테마 전환">
            {THEME_LABEL[theme]}
          </button>
          <button className="theme-btn" type="button" onClick={logout}>
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
