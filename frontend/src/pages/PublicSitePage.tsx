import { useEffect, useState } from "react";
import { Loading } from "../components/Loading";
import { useParams } from "react-router-dom";
import { resolveSite, type PublicLanding } from "../api/client";
import { LandingView } from "@leadpot/public-ui";

/**
 * 공개 사이트 페이지: {subdomain}.도메인/{랜딩번호|슬러그}. published 만 열림.
 * 방문 기록·광고 픽셀 초기화는 `LandingView` 가 내장해서 처리한다(SSR 렌더러와 로직 공유 —
 * 예전엔 여기 있었는데 SSR 전환 때 렌더러로 안 옮겨져 픽셀이 안 뜨는 회귀가 있었다, 2026-09-08).
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
