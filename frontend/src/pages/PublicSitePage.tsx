import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { resolveSite, recordVisit, type PublicLanding } from "../api/client";
import { parseUtm } from "../lib/utm";
import { LandingView } from "../components/LandingView";

/** 공개 사이트 페이지: {subdomain}.도메인/{랜딩번호|슬러그}. published 만 열림. 방문 1회 기록. */
export function PublicSitePage({ subdomain }: { subdomain: string }) {
  const { identifier } = useParams();
  const [landing, setLanding] = useState<PublicLanding | null>(null);
  const [error, setError] = useState("");
  const visited = useRef(false);

  useEffect(() => {
    if (!identifier) {
      setError("페이지를 찾을 수 없습니다.");
      return;
    }
    resolveSite(subdomain, identifier)
      .then((l) => {
        setLanding(l);
        if (!visited.current) {
          visited.current = true;
          recordVisit({ landingPageId: l.id, utm: parseUtm() });
        }
      })
      .catch(() => setError("페이지를 찾을 수 없습니다."));
  }, [subdomain, identifier]);

  if (error) return <SiteNotFound />;
  if (!landing) return <div className="page-loading">불러오는 중…</div>;
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
