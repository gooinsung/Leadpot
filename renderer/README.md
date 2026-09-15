# renderer — 공개 랜딩 SSR 렌더러

**공개 화면(랜딩·단독 리드폼)을 서버에서 완성된 HTML로 렌더**하는 Next.js(App Router) 앱.
`@leadpot/public-ui`(루트의 `packages/public-ui`)의 컴포넌트를 `frontend/`(관리 SPA)와 그대로
공유해서, 크롤러가 보는 화면과 실사용자가 보는 화면이 갈라지지 않도록 한다 —
배경은 `../docs/SSR-LANDING-PLAN.md`, 코드 지도는 `../docs/ARCHITECTURE.md` 참고.

## 왜 이 앱이 필요한가

기존 `frontend/`는 CSR SPA라 구글 광고 크롤러가 빈 셸(shell)만 보고
"시스템 우회"·"손상된 사이트" 정책 위반으로 반려됐다. 이 앱은 랜딩 콘텐츠를
**서버에서 완성된 HTML로** 내려줘서 그 문제를 근본적으로 없앤다.

## 이 앱이 처리하는 호스트 (`src/proxy.ts` 가 정본)

| 들어온 요청 | 처리 |
|---|---|
| `go.lead-pot.com/{sub}/{id}` | ⭐ **공개 랜딩 SSR** — `/site/{sub}/{id}` 로 rewrite |
| `{sub}.lead-pot.com/{id}` | 구 서브도메인 — **301 리다이렉트**만(콘텐츠 안 줌). 전환기 한시적 |
| `app.lead-pot.com/f/{id}` | 단독 공개 리드폼 SSR (`app/f/[identifier]`) |
| `app.lead-pot.com/*` (그 외) | 🔴 **관리 앱(Cloudflare Pages)으로 리버스 프록시** — `proxyToAdminApp()` |

> 🔴 **`proxyToAdminApp()` 를 지우면 관리 앱이 빈 페이지가 된다.** 와일드카드 Workers 라우트
> (`*.lead-pot.com/*`)는 DNS·커스텀 도메인 설정과 무관하게 `app.lead-pot.com` 도 가로채기 때문이다
> (2026-09-07 실제 장애). Cloudflare 라우팅 우선순위에 기대지 않고 코드로 보장한다.
>
> 🔴 **공개 랜딩이 고객별 서브도메인에서 `go` 고정 호스트로 바뀐 이유**(2026-09-09): 구글 광고 심사가
> 고객 1명의 서브도메인을 "손상된 사이트"로 판정한 사고. 평판은 URL이 아니라 **호스트 단위**로
> 매겨지므로 전부 호스트 하나 밑의 경로로 모았다.

## 로컬 실행

```bash
npm install         # 루트에서 (workspaces)
cd renderer
cp .dev.vars.example .dev.vars       # wrangler 로컬 프리뷰용
cp .env.local.example .env.local     # next dev 용
npm run dev          # http://localhost:3000
```

백엔드(Spring Boot, :8080)가 먼저 떠 있어야 실제 데이터를 받아온다.
호스트 라우팅을 로컬에서 테스트하려면 `/etc/hosts`에 `127.0.0.1 go.localhost`
(또는 구 서브도메인 리다이렉트 확인용 `127.0.0.1 <서브도메인>.localhost`)를 추가하고
그 host로 접속한다 — 예: `http://go.localhost:3000/bali/12`.

## 배포

**`main` push 시 자동 배포된다** — `renderer/**` 또는 `packages/public-ui/**` 가 바뀌면
`.github/workflows/deploy-renderer.yml` 이 Cloudflare Workers(`leadpot-renderer`)로 내보낸다.
수동으로 확인하려면 `npm run preview`(Workers 런타임 로컬 재현) → `npm run deploy`.

⚠️ `NEXT_PUBLIC_*` 는 **빌드 시점에 번들에 박힌다** — 프로덕션 값의 출처는 워크플로의 `env:` 이고,
Cloudflare 대시보드의 런타임 변수와는 별개다.

R2 증분 캐시 바인딩은 아직 비워뒀다(`wrangler.jsonc`·`open-next.config.ts` 주석 참고) —
필요해지면 R2 버킷을 만들고 양쪽을 함께 켠다.

## 주의

- `HtmlBlock`(마케터가 넣는 raw HTML 블록)은 서버·클라이언트 모두
  `dangerouslySetInnerHTML`로 그대로 렌더한다 — 마커 치환(`liveMarkers.ts`)은
  문자열 단계에서 하고, 스크립트 제거(`sanitizeHtml.ts`)는 `google_ads_safe`
  랜딩에만 조건부로 적용된다(`LandingView` 안에서 처리 — 렌더러에 별도 코드 없음).
- **공개 화면에 뭔가를 그린다면 `packages/public-ui/` 에 넣는다.** `frontend/` 에만 넣으면
  실서비스(SSR)에는 반영되지 않는다 — 광고 픽셀이 실제로 이 이유로 죽어 있었다(2026-09-08).
- 비ASCII(한글) 슬러그는 `lib/decode-identifier.ts` 의 `normalizeIdentifier()` 를 거쳐야 한다 —
  안 그러면 이중 URL 인코딩으로 조회가 항상 실패한다(2026-09-08 실제 버그).
- 백엔드로의 서버 사이드 요청은 반드시 원 방문자의 `CF-Connecting-IP`·`User-Agent`를
  그대로 전달해야 한다(`ForwardedRequestContext`, `@leadpot/public-ui`) — 안 그러면
  IP 차단 로직이 Worker의 IP를 보게 된다.
