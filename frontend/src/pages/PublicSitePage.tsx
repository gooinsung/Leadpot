import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { resolveSite, recordVisit, type PublicLanding } from "../api/client";
import { parseUtm } from "../lib/utm";
import { initPixels } from "../lib/pixels";
import { LandingView } from "../components/LandingView";

/** 랜딩에 포함된 리드폼들의 픽셀 설정을 하나로 합친다(키별 첫 유효값 우선). PageView 1회 발사용. */
function mergeFormPixels(forms: PublicLanding["forms"]): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const form of Object.values(forms)) {
    const t = form.trackingConfig;
    if (!t) continue;
    for (const [k, v] of Object.entries(t)) {
      if (v != null && String(v).trim() !== "" && merged[k] == null) merged[k] = v;
    }
  }
  return merged;
}

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
          // 픽셀은 랜딩이 아니라 '포함된 리드폼'에 설정한다.
          // 랜딩에 포함된 폼들의 픽셀을 합쳐 PageView 1회 발사(전환 Lead 는 각 폼이 자기 픽셀로 발사).
          initPixels(mergeFormPixels(l.forms));
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
