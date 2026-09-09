import { useEffect, useState } from "react";
import { Loading } from "../components/Loading";
import { useParams } from "react-router-dom";
import { resolveSite, type PublicLanding } from "../api/client";
import { LandingView } from "@leadpot/public-ui";

/**
 * 공개 사이트 페이지: {subdomain}.도메인/{랜딩번호|슬러그}. published 만 열림.
 * 방문 기록·광고 픽셀 초기화는 `LandingView` 가 내장해서 처리한다(SSR 렌더러와 로직 공유 —
 * 예전엔 여기 있었는데 SSR 전환 때 렌더러로 안 옮겨져 픽셀이 안 뜨는 회귀가 있었다, 2026-09-08).
 *
 * ⚠️ 운영 트래픽은 더 이상 이 경로를 안 탄다(2026-09-09~ go.lead-pot.com/{sub}/{id} 로 전환,
 * 서브도메인 호스트는 렌더러가 301 리다이렉트만 함, `renderer/src/proxy.ts`). 이 페이지는
 * `bali.localhost:5173` 같은 **로컬 개발 편의용**(App.tsx 의 `currentSubdomain()` 호스트 감지)으로만
 * 남아있다 — 렌더러(`next dev`)를 안 띄우고 frontend 단독으로 빠르게 확인할 때 쓴다.
 */
export function PublicSitePage({ subdomain }: { subdomain: string }) {
  const { identifier } = useParams();
  const [landing, setLanding] = useState<PublicLanding | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!identifier) {
      setError("페이지를 찾을 수 없습니다.");
      return;
    }
    resolveSite(subdomain, identifier)
      .then(setLanding)
      .catch(() => setError("페이지를 찾을 수 없습니다."));
  }, [subdomain, identifier]);

  if (error) return <SiteNotFound />;
  if (!landing) return <Loading full />;
  return <LandingView landing={landing} />;
}

/** 서브도메인 호스트에서 잘못된 경로/루트 접근 시 404 화면. */
export function SiteNotFound() {
  return (
    <div className="landing-public">
      <p className="auth-error" style={{ padding: 40, textAlign: "center" }}>페이지를 찾을 수 없습니다.</p>
    </div>
  );
}
