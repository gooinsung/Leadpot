# renderer — 공개 랜딩 SSR 렌더러

`{subdomain}.lead-pot.com/{identifier}` 로 들어오는 **공개 랜딩페이지 요청만** 처리하는
Next.js(App Router) 앱. `@leadpot/public-ui`(루트의 `packages/public-ui`)의 컴포넌트를
`frontend/`(관리 SPA)와 그대로 공유해서, 크롤러가 보는 화면과 실사용자가 보는 화면이
갈라지지 않도록 한다 — 배경은 `docs/SSR-LANDING-PLAN.md` 참고.

## 왜 이 앱이 필요한가

기존 `frontend/`는 CSR SPA라 구글 광고 크롤러가 빈 셸(shell)만 보고
"시스템 우회"·"손상된 사이트" 정책 위반으로 반려됐다. 이 앱은 랜딩 콘텐츠를
**서버에서 완성된 HTML로** 내려줘서 그 문제를 근본적으로 없앤다.

- 관리자 로그인·대시보드·빌더 등은 여전히 `frontend/`(CSR SPA)가 담당한다.
- 이 앱은 오직 `/site/{subdomain}/{identifier}` 라우트(서브도메인 랜딩)만 렌더한다.
  `proxy.ts`가 `Host` 헤더의 서브도메인을 보고 이 경로로 재작성한다.

## 로컬 실행

```bash
npm install         # 루트에서 (workspaces)
cd renderer
cp .dev.vars.example .dev.vars       # wrangler 로컬 프리뷰용
cp .env.local.example .env.local     # next dev 용
npm run dev          # http://localhost:3000
```

백엔드(Spring Boot, :8080)가 먼저 떠 있어야 실제 데이터를 받아온다.
서브도메인 라우팅을 로컬에서 테스트하려면 `/etc/hosts`에
`127.0.0.1 <서브도메인>.localhost` 같은 항목을 추가하고 그 host로 접속한다.

## 배포

Cloudflare Workers(OpenNext 어댑터). `npm run preview`로 Workers 런타임을
로컬에서 미리 확인하고, `npm run deploy`로 배포한다. R2 캐시 바인딩 등
Cloudflare 계정이 필요한 설정은 아직 비워뒀다(`open-next.config.ts` 주석 참고) —
Phase 5(`docs/SSR-LANDING-PLAN.md`)에서 사용자가 직접 계정 설정 후 채운다.

## 주의

- `HtmlBlock`(마케터가 넣는 raw HTML 블록)은 서버·클라이언트 모두
  `dangerouslySetInnerHTML`로 그대로 렌더한다 — 마커 치환(`liveMarkers.ts`)은
  문자열 단계에서 하고, 스크립트 제거(`sanitizeHtml.ts`)는 `google_ads_safe`
  랜딩에만 적용한다(Phase 4, 아직 렌더러에 안 붙임).
- 백엔드로의 서버 사이드 요청은 반드시 원 방문자의 `CF-Connecting-IP`·`User-Agent`를
  그대로 전달해야 한다(`ForwardedRequestContext`, `@leadpot/public-ui`) — 안 그러면
  IP 차단 로직이 Worker의 IP를 보게 된다.
