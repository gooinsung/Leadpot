import type { MetadataRoute } from "next";

/**
 * `*.lead-pot.com` 전체(공개 랜딩)에 적용되는 robots.txt — 이 렌더러가 모든 서브도메인을
 * 같은 Worker 로 처리하므로 로봇 규칙도 전 테넌트 공통이다(I3 SEO — 크롤러를 막을 이유가 없다,
 * 오히려 이번 SSR 전환의 목적이 "크롤러가 제대로 읽게" 하는 것이었다).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
  };
}
