"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { resolveSite, LandingView, type PublicLanding } from "@leadpot/public-ui";

/**
 * SSR 실패 시 SPA 셸로 자동 폴백(§5-5, Phase 4) — 전면 SSR 의 유일한 안전장치.
 *
 * `page.tsx` 가 백엔드 404(진짜 미존재/IP 차단)는 여기로 오지 않고 `notFound()` 로 처리한다
 * (그건 정상 동작이라 폴백이 필요 없다). 이 파일은 그 밖의 진짜 실패
 * (백엔드 장애·네트워크 오류·렌더러 버그 등)일 때만 Next 가 자동으로 렌더한다.
 *
 * 별도 CSR 앱으로 리다이렉트하는 대신, **브라우저에서 직접** 같은 공개 API 를 호출해
 * 같은 `LandingView` 를 클라이언트 렌더(SPA)한다 — 그래서 크롤러가 아니라 실제 방문자가
 * 이 경로를 볼 확률이 높은 장애 상황에서도 랜딩이 계속 보인다. 이 fetch 는 브라우저가
 * 직접 하므로 IP 도 원래 방문자 것 그대로다(§6-1 문제 자체가 없음).
 */
export default function SiteError({ error }: { error: Error & { digest?: string } }) {
  const params = useParams<{ subdomain: string; identifier: string }>();
  const [landing, setLanding] = useState<PublicLanding | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[renderer] SSR 실패, 클라이언트 폴백으로 전환:", error);
    const sub = Array.isArray(params.subdomain) ? params.subdomain[0] : params.subdomain;
    const id = Array.isArray(params.identifier) ? params.identifier[0] : params.identifier;
    if (!sub || !id) {
      setFailed(true);
      return;
    }
    resolveSite(sub, id)
      .then(setLanding)
      .catch(() => setFailed(true));
  }, [error, params]);

  if (failed) {
    return (
      <main style={{ padding: 40, textAlign: "center", color: "#556" }}>
        <p>페이지를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>
      </main>
    );
  }

  if (!landing) {
    return (
      <main style={{ padding: 40, textAlign: "center", color: "#889" }}>
        <p>불러오는 중…</p>
      </main>
    );
  }

  return (
    <div className="landing-public">
      <LandingView landing={landing} />
    </div>
  );
}
